import { frac, fracTex, paren, poly, signed } from "../../math/random";
import type { Rng } from "../../math/random";
import { md, type Generator, type Step, type Unit } from "../types";

// ── Shared helpers ──────────────────────────────────────────────────────────

const FMT = md`Answer in interval notation, typing inf for $\infty$ and U for $\cup$, as in (-inf, 2) U (2, inf). An inequality is fine too.`;

/** Typed answers that mean "every real number". */
const REALS = ["all real numbers", "all reals", "all numbers", "every real number", "any real number", "R"];

/** Coefficient in front of a factor: 1 -> "", -1 -> "-", 2 -> "2". */
const co = (a: number) => (a === 1 ? "" : a === -1 ? "-" : String(a));
/** The same for typed answers and plot expressions. */
const coTxt = (a: number) => (a === 1 ? "" : a === -1 ? "-" : `${a}*`);
/** x - h, written nicely. */
const shift = (h: number) => poly([[1, "x"], [-h, ""]]);
/** (x - h) as a factor, or just x when h is 0. */
const factor = (h: number) => (h === 0 ? "x" : `(${shift(h)})`);
/** " + k" or "" when k is 0. */
const plusK = (k: number) => (k ? ` ${signed(k)}` : "");

/** One interval: null means unbounded on that side. */
interface Iv {
  lo: number | null;
  hi: number | null;
  loOpen?: boolean;
  hiOpen?: boolean;
}
const ivText = ({ lo, hi, loOpen = true, hiOpen = true }: Iv) =>
  `${lo === null ? "(-inf" : `${loOpen ? "(" : "["}${lo}`}, ${hi === null ? "inf)" : `${hi}${hiOpen ? ")" : "]"}`}`;
const ivTex = ({ lo, hi, loOpen = true, hiOpen = true }: Iv) =>
  `${lo === null ? "(-\\infty" : `${loOpen ? "(" : "["}${lo}`}, ${hi === null ? "\\infty)" : `${hi}${hiOpen ? ")" : "]"}`}`;
const unionText = (ivs: Iv[]) => ivs.map(ivText).join(" U ");
const unionTex = (ivs: Iv[]) => ivs.map(ivTex).join(" \\cup ");

/** Every real number except the listed ones (sorted ascending). */
const allBut = (cuts: number[]): Iv[] => {
  const s = [...cuts].sort((a, b) => a - b);
  return [null, ...s].map((lo, i) => ({ lo, hi: i < s.length ? s[i]! : null }));
};

type Parent = "square" | "abs" | "sqrt";
const PARENT_TEX: Record<Parent, string> = { square: "x^2", abs: "|x|", sqrt: "\\sqrt{x}" };
const PARENT_TXT: Record<Parent, string> = { square: "x^2", abs: "abs(x)", sqrt: "sqrt(x)" };
const PARENT_NAME: Record<Parent, string> = { square: "parabola", abs: "V", sqrt: "half-parabola" };

/** The parent applied to x - h, as LaTeX and as typed text. */
function body(p: Parent, h: number): { tex: string; txt: string } {
  const inner = shift(h);
  if (p === "square") return { tex: h === 0 ? "x^2" : `(${inner})^2`, txt: `(${inner})^2` };
  if (p === "abs") return { tex: `|${inner}|`, txt: `abs(${inner})` };
  return { tex: `\\sqrt{${inner}}`, txt: `sqrt(${inner})` };
}

/** a * parent(x - h) + k as LaTeX and typed text. */
function shaped(p: Parent, a: number, h: number, k: number) {
  const b = body(p, h);
  return { tex: `${co(a)}${b.tex}${plusK(k)}`, txt: `${coTxt(a)}${b.txt}${plusK(k)}` };
}

/** A linear function as LaTeX, its value, typed text of f(arg), and LaTeX of f(arg). */
function linear(a: number, b: number) {
  return {
    tex: poly([[a, "x"], [b, ""]]),
    at: (v: number) => a * v + b,
    txt: (arg: string) => `${a}*(${arg}) + (${b})`,
    sub: (arg: string) => `${co(a)}(${arg})${plusK(b)}`,
  };
}
/** s x^2 + c. */
function quadratic(s: number, c: number) {
  return {
    tex: poly([[s, "x^2"], [c, ""]]),
    at: (v: number) => s * v * v + c,
    txt: (arg: string) => `${s}*(${arg})^2 + (${c})`,
    sub: (arg: string) => `${co(s)}(${arg})^2${plusK(c)}`,
  };
}

function pickDistinct(r: Rng, lo: number, hi: number, avoid: number): number {
  for (;;) {
    const n = r.int(lo, hi);
    if (n !== avoid) return n;
  }
}

// ── Lesson 1: Domain and range ──────────────────────────────────────────────

const domainOf: Generator = (r) => {
  const kind = r.int(0, 6);
  const c = r.int(-6, 6);
  if (kind <= 1 || kind === 4) {
    const a = r.int(1, 4);
    const up = kind !== 1;
    const strict = kind === 4;
    const rad = up ? poly([[a, "x"], [-a * c, ""]]) : poly([[a * c, ""], [-a, "x"]]);
    const k = r.int(1, 9);
    const E = strict ? md`\frac{${k}}{\sqrt{${rad}}}` : md`\sqrt{${rad}}`;
    const rel = strict ? ">" : "\\ge";
    const iv: Iv = up ? { lo: c, hi: null, loOpen: strict } : { lo: null, hi: c, hiOpen: false };
    const steps: Step[] = [
      {
        math: md`${rad} ${rel} 0`,
        note: strict
          ? md`The root needs a radicand of 0 or more, and the root sits in a denominator, so it can't be 0 either. Together: strictly positive.`
          : md`A square root needs the expression under it to be 0 or more.`,
      },
    ];
    if (a * c !== 0) steps.push({ math: md`${poly([[up ? a : -a, "x"]])} ${rel} ${up ? a * c : -a * c}`, note: md`${up === (a * c > 0) ? "Add" : "Subtract"} ${Math.abs(a * c)} on both sides.` });
    if (!(up && a === 1)) {
      steps.push({
        math: md`x ${up ? rel : "\\le"} ${c}`,
        note: up ? md`Divide by ${a}, a positive number, so the sign stays.` : md`Divide by $-${a}$. Dividing by a negative flips the inequality.`,
      });
    }
    steps.push({ math: ivTex(iv), note: strict ? md`${c} is left out: there $\sqrt{0} = 0$ lands in the denominator.` : md`${c} is included, since $\sqrt{0} = 0$ is fine.` });
    return {
      prompt: md`Find the domain of $f(x) = ${E}$. ${FMT}`,
      answer: ivText(iv),
      form: "inequality",
      hint: strict ? "The radicand must be 0 or more, and the denominator can't be 0." : "The expression under a square root must be 0 or more.",
      solution: steps,
    };
  }
  if (kind === 2) {
    const k = r.int(1, 9);
    const ivs = allBut([c]);
    return {
      prompt: md`Find the domain of $f(x) = \frac{${k}}{${shift(c)}}$. ${FMT}`,
      answer: unionText(ivs),
      form: "inequality",
      hint: "Which input makes the denominator 0?",
      solution: [
        { math: md`${shift(c)} = 0 \quad\Rightarrow\quad x = ${c}`, note: "The only trouble is a zero denominator." },
        { math: unionTex(ivs), note: md`Every real number except ${c}. Two open pieces, joined by $\cup$.` },
      ],
    };
  }
  if (kind === 3) {
    const E = r.next() < 0.5 ? poly([[r.coef(-4, 4), "x^2"], [r.nonzero(-9, 9), "x"], [r.int(-9, 9), ""]]) : poly([[r.coef(-6, 6), "x"], [r.nonzero(-9, 9), ""]]);
    return {
      prompt: md`Find the domain of $f(x) = ${E}$. ${FMT}`,
      answer: "(-inf, inf)",
      accept: REALS,
      form: "inequality",
      hint: "Is there any input that makes this rule break? Look for a denominator or a square root.",
      solution: [
        { math: E, note: "Only multiplication, addition and whole-number powers. These work for every real number." },
        { math: md`(-\infty, \infty)`, note: "No denominator and no root, so nothing is excluded." },
      ],
    };
  }
  if (kind === 5) {
    const d = c + r.int(1, 5);
    const ivs: Iv[] = [
      { lo: c, hi: d, loOpen: false },
      { lo: d, hi: null },
    ];
    return {
      prompt: md`Find the domain of $f(x) = \frac{\sqrt{${shift(c)}}}{${shift(d)}}$. ${FMT}`,
      answer: unionText(ivs),
      form: "inequality",
      hint: "Two conditions: the radicand must be 0 or more, and the denominator can't be 0.",
      solution: [
        { math: md`${shift(c)} \ge 0 \quad\Rightarrow\quad x \ge ${c}`, note: "The square root needs a radicand of 0 or more." },
        { math: md`${shift(d)} \ne 0 \quad\Rightarrow\quad x \ne ${d}`, note: "The denominator can't be 0." },
        { math: unionTex(ivs), note: md`Start at ${c} (included) and remove the single point ${d}.` },
      ],
    };
  }
  const m = r.int(1, 5);
  const k = r.int(1, 9);
  const ivs = allBut([-m, m]);
  return {
    prompt: md`Find the domain of $f(x) = \frac{${k}}{x^2 - ${m * m}}$. ${FMT}`,
    answer: unionText(ivs),
    form: "inequality",
    hint: "Find every input that makes the denominator 0. There may be more than one.",
    solution: [
      { math: md`x^2 - ${m * m} = 0`, note: "Set the denominator equal to 0." },
      { math: md`(x - ${m})(x + ${m}) = 0`, note: "Difference of squares." },
      { math: md`x = ${m} \text{ or } x = -${m}`, note: "Zero product property." },
      { math: unionTex(ivs), note: "Everything else: three open pieces." },
    ],
  };
};

const excludedValues: Generator = (r) => {
  const kind = r.int(0, 4);
  const k = r.int(1, 9);
  const LIST = "List them, separated by commas.";
  if (kind === 0) {
    const p = r.int(-6, 6);
    const q = pickDistinct(r, -6, 6, p);
    const den = poly([[1, "x^2"], [-(p + q), "x"], [p * q, ""]]);
    return {
      prompt: md`Which real numbers are **not** in the domain of $f(x) = \frac{${k}}{${den}}$? ${LIST}`,
      answer: `${p}, ${q}`,
      form: "set",
      verify: [`${den} = 0`],
      hint: "Set the denominator equal to 0 and factor.",
      solution: [
        { math: md`${den} = 0`, note: "Division by 0 is the only problem here." },
        { math: md`${factor(p)}${factor(q)} = 0`, note: md`Two numbers with product ${p * q} and sum ${-(p + q)}: ${-p} and ${-q}.` },
        { math: md`x = ${p} \text{ or } x = ${q}`, note: "Zero product property. These two inputs are excluded; every other number is fine." },
      ],
    };
  }
  if (kind === 1) {
    const m = r.int(2, 5);
    let n = r.nonzero(-9, 9);
    while (n % m === 0) n = r.nonzero(-9, 9);
    const den = poly([[m, "x"], [-n, ""]]);
    return {
      prompt: md`Which real number is **not** in the domain of $f(x) = \frac{x + ${k}}{${den}}$? Give it as a fraction if needed.`,
      answer: frac(n, m),
      form: "set",
      verify: [`${den} = 0`],
      hint: "Set the denominator equal to 0 and solve. The numerator doesn't matter.",
      solution: [
        { math: md`${den} = 0`, note: "The denominator can't be 0." },
        { math: md`x = ${fracTex(n, m)}`, note: md`${n > 0 ? "Add" : "Subtract"} ${Math.abs(n)}, then divide by ${m}.` },
      ],
    };
  }
  if (kind === 2) {
    const m = r.int(1, 6);
    return {
      prompt: md`Which real numbers are **not** in the domain of $g(x) = \frac{${co(k)}x}{x^2 - ${m * m}}$? ${LIST}`,
      answer: `${m}, ${-m}`,
      form: "set",
      verify: [`x^2 - ${m * m} = 0`],
      hint: "Set the denominator equal to 0. A square equal to a positive number has two solutions.",
      solution: [
        { math: md`x^2 - ${m * m} = 0`, note: "Set the denominator equal to 0." },
        { math: md`(x - ${m})(x + ${m}) = 0`, note: "Difference of squares." },
        { math: md`x = ${m} \text{ or } x = -${m}`, note: "Both are excluded." },
      ],
    };
  }
  if (kind === 3) {
    const j = r.nonzero(-8, 8);
    const den = poly([[1, "x^2"], [j, "x"]]);
    return {
      prompt: md`Which real numbers are **not** in the domain of $h(x) = \frac{${k}}{${den}}$? ${LIST}`,
      answer: `0, ${-j}`,
      form: "set",
      verify: [`${den} = 0`],
      hint: "Factor out x from the denominator.",
      solution: [
        { math: md`${den} = 0`, note: "Set the denominator equal to 0." },
        { math: md`x(${poly([[1, "x"], [j, ""]])}) = 0`, note: "Common factor x." },
        { math: md`x = 0 \text{ or } x = ${-j}`, note: md`Don't lose $x = 0$: it makes the first factor 0.` },
      ],
    };
  }
  const m = r.int(2, 5);
  const n = r.nonzero(-12, 12);
  const smallest = r.next() < 0.5;
  const rad = smallest ? poly([[m, "x"], [-n, ""]]) : poly([[n, ""], [-m, "x"]]);
  return {
    prompt: md`What is the **${smallest ? "smallest" : "largest"}** number in the domain of $f(x) = \sqrt{${rad}}$? Give it as a fraction if needed.`,
    answer: frac(n, m),
    verify: [`${rad} = 0`],
    hint: "The radicand must be 0 or more. The boundary is where it equals 0 exactly.",
    solution: [
      { math: md`${rad} \ge 0`, note: "The domain of a square root." },
      { math: md`x ${smallest ? "\\ge" : "\\le"} ${fracTex(n, m)}`, note: smallest ? md`Solve: divide by ${m}.` : md`Solve: divide by $-${m}$, which flips the sign.` },
      { math: fracTex(n, m), note: md`The boundary itself is allowed, since $\sqrt{0} = 0$. So it is the ${smallest ? "smallest" : "largest"} input.` },
    ],
  };
};

const rangeOf: Generator = (r) => {
  const kind = r.pick([0, 0, 1, 2, 3]);
  if (kind === 0) {
    const p = r.pick<Parent>(["square", "abs", "sqrt"]);
    const a = r.pick([1, 1, -1, -1, 2, -2]);
    const h = r.int(-6, 6);
    const k = r.int(-9, 9);
    const f = shaped(p, a, h, k);
    const b = body(p, h);
    const iv: Iv = a > 0 ? { lo: k, hi: null, loOpen: false } : { lo: null, hi: k, hiOpen: false };
    const reach = p === "square" ? md`$x = ${h} + \sqrt{t}$` : p === "abs" ? md`$x = ${h} + t$` : md`$x = ${h} + t^2$`;
    return {
      prompt: md`Find the range of $f(x) = ${f.tex}$. ${FMT}`,
      answer: ivText(iv),
      form: "inequality",
      hint: md`$${b.tex}$ is never negative, and it equals 0 at $x = ${h}$. What does that make the ${a > 0 ? "smallest" : "largest"} output?`,
      solution: [
        { math: md`${b.tex} \ge 0`, note: md`A ${p === "square" ? "square" : p === "abs" ? "distance" : "principal square root"} is never negative. It is 0 at $x = ${h}$.` },
        ...(a === 1
          ? []
          : [{ math: md`${co(a)}${b.tex} ${a > 0 ? "\\ge" : "\\le"} 0`, note: a > 0 ? `Multiplying by ${a} keeps it at least 0.` : `Multiplying by ${a}, a negative, flips it: never positive.` }]),
        { math: md`f(x) ${a > 0 ? "\\ge" : "\\le"} ${k}`, note: md`${k === 0 ? "Nothing to add" : k > 0 ? `Add ${k}` : `Subtract ${-k}`}: so ${k} is the ${a > 0 ? "lowest" : "highest"} output, reached at $x = ${h}$.` },
        { math: ivTex(iv), note: md`And every value of $${b.tex}$ from 0 up is reached: $${b.tex} = t$ at ${reach}. So every output on that side of ${k} occurs.` },
      ],
    };
  }
  if (kind === 1) {
    const m = r.nonzero(-4, 4);
    const b = r.int(-6, 6);
    const p = r.int(-5, 1);
    const q = p + r.int(2, 6);
    const [fp, fq] = [m * p + b, m * q + b];
    const iv: Iv = { lo: Math.min(fp, fq), hi: Math.max(fp, fq), loOpen: false, hiOpen: false };
    return {
      prompt: md`The function $f(x) = ${poly([[m, "x"], [b, ""]])}$ has domain $${p} \le x \le ${q}$. Find its range. ${FMT}`,
      answer: ivText(iv),
      form: "inequality",
      hint: "A line rises (or falls) steadily, so its highest and lowest outputs are at the ends of the domain.",
      solution: [
        { math: md`f(${p}) = ${co(m)}(${p})${plusK(b)} = ${fp}`, note: "Output at the left end." },
        { math: md`f(${q}) = ${co(m)}(${q})${plusK(b)} = ${fq}`, note: "Output at the right end." },
        { math: ivTex(iv), note: m > 0 ? "The slope is positive, so outputs climb steadily from one value to the other, hitting everything in between." : "The slope is negative, so the outputs fall steadily: the left end gives the top of the range. Write the smaller number first." },
      ],
    };
  }
  if (kind === 2) {
    // A parabola on a restricted domain, shown as a graph.
    let s = 1, h = 0, k = 0, x1 = 0, x2 = 0;
    const f = (x: number) => s * (x - h) ** 2 + k;
    do {
      s = r.sign();
      h = r.int(-2, 2);
      k = s > 0 ? r.int(-5, -1) : r.int(1, 5);
      x1 = h - r.int(-1, 3);
      x2 = Math.min(x1 + r.int(2, 4), h + 3);
    } while (Math.abs(f(x1)) > 6 || Math.abs(f(x2)) > 6 || x2 <= x1);
    const openL = r.next() < 0.3;
    const openR = !openL && r.next() < 0.3;
    const cands = [
      { x: x1, v: f(x1), closed: !openL },
      { x: x2, v: f(x2), closed: !openR },
      ...(x1 < h && h < x2 ? [{ x: h, v: k, closed: true }] : []),
    ];
    const lo = Math.min(...cands.map((c) => c.v));
    const hi = Math.max(...cands.map((c) => c.v));
    const iv: Iv = { lo, hi, loOpen: !cands.some((c) => c.v === lo && c.closed), hiOpen: !cands.some((c) => c.v === hi && c.closed) };
    const vertexInside = x1 < h && h < x2;
    return {
      prompt: md`The graph shows all of a function $f$. A filled dot is part of the graph and a hollow dot is not. Find the range of $f$. ${FMT}`,
      figure: {
        kind: "plot",
        x: [-6, 6],
        y: [-6, 6],
        curves: [{ expr: `${s}*(x - (${h}))^2 + (${k})`, domain: [x1, x2] }],
        points: [
          { x: x1, y: f(x1), open: openL, label: `(${x1}, ${f(x1)})` },
          { x: x2, y: f(x2), open: openR, label: `(${x2}, ${f(x2)})` },
        ],
      },
      answer: ivText(iv),
      form: "inequality",
      hint: "The range is the set of heights the graph reaches. Check the two ends and the turning point, if the graph has one between them.",
      solution: [
        {
          math: md`f(${x1}) = ${f(x1)}, \quad f(${x2}) = ${f(x2)}`,
          note: `The heights at the ends.${openL || openR ? ` The ${openL ? "left" : "right"} end is hollow, so that height is reached only if some other point of the graph has it.` : ""}`,
        },
        {
          math: vertexInside ? md`\text{turning point } (${h}, ${k})` : md`\text{no turning point between } ${x1} \text{ and } ${x2}`,
          note: vertexInside ? md`The graph turns at $x = ${h}$, inside the domain, so ${k} is the ${s > 0 ? "lowest" : "highest"} height.` : "The graph only rises or only falls on this domain, so the ends give the extremes.",
        },
        { math: ivTex(iv), note: "Lowest height to highest. The graph is unbroken, so every height in between is reached." },
      ],
    };
  }
  const h = r.int(-6, 6);
  const k = r.nonzero(-6, 6);
  const ivs = allBut([k]);
  return {
    prompt: md`Find the range of $f(x) = \frac{1}{${shift(h)}} ${signed(k)}$. ${FMT}`,
    answer: unionText(ivs),
    form: "inequality",
    hint: "Call the output y and solve for x. Which y-value gives no input?",
    solution: [
      { math: md`y = \frac{1}{${shift(h)}} ${signed(k)}`, note: "A number y is in the range when this has a solution x." },
      { math: md`y ${signed(-k)} = \frac{1}{${shift(h)}}`, note: md`Isolate the fraction.` },
      { math: md`x = ${h ? `${h} + ` : ""}\frac{1}{y ${signed(-k)}}`, note: md`Take reciprocals${h ? `, then ${h > 0 ? "add" : "subtract"} ${Math.abs(h)}` : ""}. This works for every $y$ except $y = ${k}$.` },
      { math: unionTex(ivs), note: md`At $y = ${k}$ the fraction would have to be 0, and $\frac{1}{\text{anything}}$ never is.` },
    ],
  };
};

// ── Lesson 2: Function notation and composition ─────────────────────────────

const composeValue: Generator = (r) => {
  const f = linear(r.coef(-5, 5), r.nonzero(-9, 9));
  const g = quadratic(r.pick([1, -1]), r.int(-5, 5));
  const kind = r.int(0, 3);
  const t = kind === 3 ? r.int(-2, 2) : r.nonzero(-3, 3);
  const [outer, inner, on, ln] = (
    [
      [f, g, "f", "g"],
      [g, f, "g", "f"],
      [f, f, "f", "f"],
      [g, g, "g", "g"],
    ] as const
  )[kind]!;
  const mid = inner.at(t);
  const value = outer.at(mid);
  const asked = r.next() < 0.5 ? md`(${on} \circ ${ln})(${t})` : md`${on}(${ln}(${t}))`;
  return {
    prompt: md`Let $f(x) = ${f.tex}$ and $g(x) = ${g.tex}$. Find $${asked}$.`,
    answer: String(value),
    verify: [`y = ${outer.txt(inner.txt(String(t)))}`],
    hint: md`Work from the inside out: find $${ln}(${t})$ first, then put that number into $${on}$.`,
    solution: [
      { math: md`${ln}(${t}) = ${inner.sub(String(t))} = ${mid}`, note: "The inner function acts first." },
      { math: md`${on}(${mid}) = ${outer.sub(String(mid))} = ${value}`, note: md`Its output, ${mid}, is the input to $${on}$.` },
    ],
  };
};

const composeExpr: Generator = (r) => {
  const kind = r.int(0, 4);
  const a = r.coef(-5, 5);
  const b = r.nonzero(-7, 7);
  const ASK = "Write it as an expression in $x$, multiplied out.";
  if (kind === 0) {
    const c = r.coef(-5, 5);
    const d = r.nonzero(-7, 7);
    const f = linear(a, b);
    const g = linear(c, d);
    const ans = poly([[a * c, "x"], [a * d + b, ""]]);
    return {
      prompt: md`Let $f(x) = ${f.tex}$ and $g(x) = ${g.tex}$. Find $f(g(x))$. ${ASK}`,
      answer: ans,
      expanded: true,
      hint: md`Replace the $x$ in $f$ with the whole expression $g(x) = ${g.tex}$, in parentheses.`,
      solution: [
        { math: md`f(g(x)) = ${f.sub(g.tex)}`, note: md`$g(x)$ is the input to $f$.` },
        { math: poly([[a * c, "x"], [a * d, ""], [b, ""]]), note: "Distribute." },
        { math: ans, note: md`Combine. The slope is $${a} \cdot ${paren(c)} = ${a * c}$, the product of the two slopes.` },
      ],
    };
  }
  if (kind === 1) {
    const s = r.pick([1, -1]);
    const c = r.nonzero(-6, 6);
    const f = linear(a, b);
    const g = quadratic(s, c);
    const ans = poly([[a * s, "x^2"], [a * c + b, ""]]);
    return {
      prompt: md`Let $f(x) = ${f.tex}$ and $g(x) = ${g.tex}$. Find $f(g(x))$. ${ASK}`,
      answer: ans,
      expanded: true,
      hint: md`$f$ is the outer function. Put $${g.tex}$ in place of its $x$.`,
      solution: [
        { math: md`f(g(x)) = ${f.sub(g.tex)}`, note: md`Substitute $g(x)$ for $x$ in $f$.` },
        { math: poly([[a * s, "x^2"], [a * c, ""], [b, ""]]), note: "Distribute." },
        { math: ans, note: "Combine the constants." },
      ],
    };
  }
  if (kind === 2) {
    const s = r.pick([1, -1]);
    const c = r.int(-6, 6);
    const f = linear(r.coef(-3, 3), b);
    const fa = (f.at(1) - f.at(0));
    const g = quadratic(s, c);
    const ans = poly([[s * fa * fa, "x^2"], [2 * s * fa * b, "x"], [s * b * b + c, ""]]);
    return {
      prompt: md`Let $f(x) = ${f.tex}$ and $g(x) = ${g.tex}$. Find $g(f(x))$. ${ASK}`,
      answer: ans,
      expanded: true,
      hint: md`$g$ is the outer function here, so it squares the whole of $f(x)$. Expand with $(A + B)^2 = A^2 + 2AB + B^2$.`,
      solution: [
        { math: md`g(f(x)) = ${g.sub(f.tex)}`, note: md`Substitute $f(x)$ for $x$ in $g$.` },
        { math: md`${co(s)}(${poly([[fa * fa, "x^2"], [2 * fa * b, "x"], [b * b, ""]])})${plusK(c)}`, note: "Square the binomial." },
        { math: ans, note: s < 0 ? "Distribute the minus sign, then combine constants." : "Combine the constants." },
      ],
    };
  }
  if (kind === 3) {
    const p = r.int(-6, 6);
    const q = r.int(-9, 9);
    const h = r.nonzero(-4, 4);
    const fTex = poly([[1, "x^2"], [p, "x"], [q, ""]]);
    const ans = poly([[1, "x^2"], [2 * h + p, "x"], [h * h + p * h + q, ""]]);
    const arg = poly([[1, "x"], [h, ""]]);
    return {
      prompt: md`Let $f(x) = ${fTex}$. Find $f(${arg})$. ${ASK}`,
      answer: ans,
      expanded: true,
      hint: md`Replace **every** $x$ in the rule with $(${arg})$. This is not $f(x) ${signed(h)}$.`,
      solution: [
        { math: md`(${arg})^2${p ? ` ${p < 0 ? "-" : "+"} ${co(Math.abs(p))}(${arg})` : ""}${plusK(q)}`, note: "Substitute into every x." },
        { math: poly([[1, "x^2"], [2 * h, "x"], [h * h, ""], [p, "x"], [p * h, ""], [q, ""]]), note: "Expand the square and distribute." },
        { math: ans, note: "Combine like terms." },
      ],
    };
  }
  const f = linear(a, b);
  const ans = poly([[a * a, "x"], [a * b + b, ""]]);
  return {
    prompt: md`Let $f(x) = ${f.tex}$. Find $f(f(x))$. ${ASK}`,
    answer: ans,
    expanded: true,
    hint: md`Feed $f$ its own output: replace $x$ in $f$ with $${f.tex}$.`,
    solution: [
      { math: md`f(f(x)) = ${f.sub(f.tex)}`, note: "The inner f's output is the outer f's input." },
      { math: poly([[a * a, "x"], [a * b, ""], [b, ""]]), note: "Distribute." },
      { math: ans, note: md`Combine. The slope is $${paren(a)}^2 = ${a * a}$.` },
    ],
  };
};

const solveNotation: Generator = (r) => {
  const kind = r.int(0, 3);
  const a = r.coef(-6, 6);
  const b = r.nonzero(-9, 9);
  const x = r.nonzero(-6, 6);
  const f = linear(a, b);
  if (kind === 0) {
    const k = f.at(x);
    return {
      prompt: md`Let $f(x) = ${f.tex}$. Find the input $x$ with $f(x) = ${k}$. Give the value of $x$.`,
      answer: String(x),
      verify: [`${f.txt("x")} = ${k}`],
      hint: md`$f(x) = ${k}$ is the equation $${f.tex} = ${k}$.`,
      solution: [
        { math: md`${f.tex} = ${k}`, note: "Write out the rule." },
        { math: md`${a}x = ${k - b}`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)}.` },
        { math: md`x = ${x}`, note: md`Divide by ${a}. Check: $f(${x}) = ${k}$.` },
      ],
    };
  }
  if (kind === 1) {
    const c = r.coef(-4, 4);
    const d = r.nonzero(-6, 6);
    const g = linear(c, d);
    const k = f.at(g.at(x));
    return {
      prompt: md`Let $f(x) = ${f.tex}$ and $g(x) = ${g.tex}$. Find the input $x$ with $f(g(x)) = ${k}$. Give the value of $x$.`,
      answer: String(x),
      verify: [`${f.txt(g.txt("x"))} = ${k}`],
      hint: md`Write $f(g(x))$ as an expression first, then solve. Or undo $f$ to find $g(x)$, then undo $g$.`,
      solution: [
        { math: md`${f.sub(g.tex)} = ${k}`, note: "Substitute g(x) into f." },
        { math: md`${g.tex} = ${g.at(x)}`, note: md`Undo $f$: ${b > 0 ? "subtract" : "add"} ${Math.abs(b)}, then divide by ${a}. So $g(x) = ${g.at(x)}$.` },
        { math: md`x = ${x}`, note: md`Undo $g$: ${d > 0 ? "subtract" : "add"} ${Math.abs(d)}, then divide by ${c}.` },
      ],
    };
  }
  if (kind === 2) {
    let c = r.coef(-6, 6);
    while (c === a) c = r.coef(-6, 6);
    const d = (a - c) * x + b;
    const g = linear(c, d);
    return {
      prompt: md`Let $f(x) = ${f.tex}$ and $g(x) = ${g.tex}$. Find the input $x$ with $f(x) = g(x)$. Give the value of $x$.`,
      answer: String(x),
      verify: [`${f.txt("x")} = ${g.txt("x")}`],
      hint: "Set the two rules equal and solve. On a graph, this is where the two lines cross.",
      solution: [
        { math: md`${f.tex} = ${g.tex}`, note: "Same input, same output." },
        { math: md`${poly([[a - c, "x"]])} = ${d - b}`, note: "Collect x-terms on the left, constants on the right." },
        { math: md`x = ${x}`, note: a - c === 1 ? "" : md`Divide by ${a - c}.` },
      ],
    };
  }
  const p = r.nonzero(-6, 6);
  const m = r.int(1, 6);
  const fi = linear(1, p);
  return {
    prompt: md`Let $f(x) = ${fi.tex}$ and $g(x) = x^2$. Find every $x$ with $g(f(x)) = ${m * m}$. List the values, separated by commas.`,
    answer: `${-p + m}, ${-p - m}`,
    form: "set",
    verify: [`(x + (${p}))^2 = ${m * m}`],
    hint: md`$g(f(x)) = (${fi.tex})^2$. A square equals ${m * m} when the thing squared is $${m}$ or $-${m}$.`,
    solution: [
      { math: md`(${fi.tex})^2 = ${m * m}`, note: "g squares its input, and the input is f(x)." },
      { math: md`${fi.tex} = ${m} \quad\text{or}\quad ${fi.tex} = -${m}`, note: md`The numbers whose square is ${m * m}.` },
      { math: md`x = ${-p + m} \quad\text{or}\quad x = ${-p - m}`, note: md`${p > 0 ? "Subtract" : "Add"} ${Math.abs(p)} in each.` },
    ],
  };
};

// ── Lesson 3: Inverse functions ─────────────────────────────────────────────

const inverseFormula: Generator = (r) => {
  const kind = r.int(0, 4);
  const ASK = md`Write $f^{-1}(x)$ as an expression in $x$.`;
  if (kind === 0) {
    const a = r.coef(-6, 6);
    const b = r.nonzero(-9, 9);
    return {
      prompt: md`Find the inverse of $f(x) = ${poly([[a, "x"], [b, ""]])}$. ${ASK}`,
      answer: `(${shift(b)})/${paren(a)}`,
      hint: md`Write $y = ${poly([[a, "x"], [b, ""]])}$, swap $x$ and $y$, then solve for $y$.`,
      solution: [
        { math: md`x = ${poly([[a, "y"], [b, ""]])}`, note: "Swap x and y." },
        { math: md`${shift(b)} = ${a}y`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)}.` },
        { math: md`f^{-1}(x) = \frac{${shift(b)}}{${a}}`, note: md`Divide by ${a}. In words: undo the $${signed(b)}$ first, then undo the multiplication by ${a}.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(2, 6);
    const b = r.nonzero(-9, 9);
    const top = poly([[1, "x"], [b, ""]]);
    const ans = poly([[a, "x"], [-b, ""]]);
    return {
      prompt: md`Find the inverse of $f(x) = \frac{${top}}{${a}}$. ${ASK}`,
      answer: ans,
      hint: "Swap x and y, multiply both sides by the denominator, then isolate y.",
      solution: [
        { math: md`x = \frac{${poly([[1, "y"], [b, ""]])}}{${a}}`, note: "Swap x and y." },
        { math: md`${a}x = ${poly([[1, "y"], [b, ""]])}`, note: md`Multiply by ${a}.` },
        { math: md`f^{-1}(x) = ${ans}`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)}.` },
      ],
    };
  }
  if (kind === 2) {
    const p = r.int(-5, 5);
    const q = r.int(-5, 5);
    const xp = p === 0 ? "x" : shift(p);
    const xq = q === 0 ? "x" : shift(q);
    const yp = poly([[1, "y"], [-p, ""]]);
    return {
      prompt: md`Find the inverse of $f(x) = \frac{1}{${xp}}${plusK(q)}$. ${ASK}`,
      answer: `1/(${xq})${plusK(p)}`,
      hint: "Swap x and y. Isolate the fraction, then take reciprocals of both sides.",
      solution: [
        { math: md`x = \frac{1}{${yp}}${plusK(q)}`, note: "Swap x and y." },
        ...(q ? [{ math: md`${xq} = \frac{1}{${yp}}`, note: md`${q > 0 ? "Subtract" : "Add"} ${Math.abs(q)}.` }] : []),
        { math: md`${yp} = \frac{1}{${xq}}`, note: "Take reciprocals: if A = 1/B, then B = 1/A." },
        { math: md`f^{-1}(x) = \frac{1}{${xq}}${plusK(p)}`, note: p ? md`${p > 0 ? "Add" : "Subtract"} ${Math.abs(p)}.` : "Already solved for y." },
      ],
    };
  }
  if (kind === 3) {
    const p = r.int(-6, 6);
    const q = r.int(-6, 6);
    const ans = `${factor(q)}^2${plusK(p)}`;
    return {
      prompt: md`Find the inverse of $f(x) = \sqrt{${shift(p)}}${plusK(q)}$, whose domain is $x \ge ${p}$. ${ASK} (Its domain is $x \ge ${q}$, the range of $f$.)`,
      answer: ans,
      hint: "Swap x and y, isolate the square root, then square both sides.",
      solution: [
        { math: md`x = \sqrt{${poly([[1, "y"], [-p, ""]])}}${plusK(q)}`, note: "Swap x and y." },
        ...(q ? [{ math: md`${shift(q)} = \sqrt{${poly([[1, "y"], [-p, ""]])}}`, note: md`${q > 0 ? "Subtract" : "Add"} ${Math.abs(q)}.` }] : []),
        { math: md`${factor(q)}^2 = ${poly([[1, "y"], [-p, ""]])}`, note: md`Square both sides. Safe here: on $x \ge ${q}$ the left side of the previous line is not negative, so no false solutions appear.` },
        { math: md`f^{-1}(x) = ${ans}, \quad x \ge ${q}`, note: md`${p ? `${p > 0 ? "Add" : "Subtract"} ${Math.abs(p)}. ` : ""}The restriction keeps this the right half of a parabola.` },
      ],
    };
  }
  const m = r.nonzero(-6, 6);
  const n = pickDistinct(r, -6, 6, m);
  const top = poly([[1, "x"], [m, ""]]);
  const bot = n === 0 ? "x" : poly([[1, "x"], [n, ""]]);
  const num = poly([[-n, "x"], [m, ""]]);
  return {
    prompt: md`Find the inverse of $f(x) = \frac{${top}}{${bot}}$. ${ASK}`,
    answer: `(${num})/(x - 1)`,
    hint: "Swap x and y, clear the fraction, move every y-term to one side and factor out y.",
    solution: [
      { math: md`x = \frac{${poly([[1, "y"], [m, ""]])}}{${n === 0 ? "y" : poly([[1, "y"], [n, ""]])}}`, note: "Swap x and y." },
      { math: md`${poly([[1, "xy"], [n, "x"]])} = ${poly([[1, "y"], [m, ""]])}`, note: "Multiply both sides by the denominator and distribute." },
      { math: md`xy - y = ${num}`, note: "y-terms to the left, everything else to the right." },
      { math: md`y(x - 1) = ${num}`, note: "Factor out y." },
      { math: md`f^{-1}(x) = \frac{${num}}{x - 1}`, note: md`Divide by $x - 1$. The inverse excludes $x = 1$, because $f$ never outputs 1: that would need $${top} = ${bot}$.` },
    ],
  };
};

const inverseValue: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const f = linear(r.coef(-6, 6), r.nonzero(-9, 9));
    const x = r.nonzero(-7, 7);
    const k = f.at(x);
    return {
      prompt: md`Let $f(x) = ${f.tex}$. Find $f^{-1}(${k})$.`,
      answer: String(x),
      verify: [`${f.txt("x")} = ${k}`],
      hint: md`$f^{-1}(${k})$ is the input that $f$ sends to ${k}. Solve $f(x) = ${k}$.`,
      solution: [
        { math: md`${f.tex} = ${k}`, note: md`$f^{-1}(${k}) = x$ exactly when $f(x) = ${k}$.` },
        { math: md`x = ${x}`, note: "Undo the operations in reverse order." },
        { math: md`f(${x}) = ${k} \;\checkmark`, note: md`So $f^{-1}(${k}) = ${x}$.` },
      ],
    };
  }
  if (kind === 1) {
    const c = r.int(-9, 9);
    const m = r.int(1, 6);
    const k = m * m + c;
    return {
      prompt: md`Let $f(x) = ${poly([[1, "x^2"], [c, ""]])}$ with domain $x \ge 0$, so that $f$ is one-to-one. Find $f^{-1}(${k})$.`,
      answer: String(m),
      verify: [`x^2 + (${c}) = ${k}`],
      hint: md`Solve $f(x) = ${k}$, keeping only the solution in the domain $x \ge 0$.`,
      solution: [
        { math: md`${poly([[1, "x^2"], [c, ""]])} = ${k}`, note: md`The input that gives ${k}.` },
        { math: md`x^2 = ${m * m}`, note: c ? md`${c > 0 ? "Subtract" : "Add"} ${Math.abs(c)}.` : "" },
        { math: md`x = ${m}`, note: md`$x = -${m}$ also squares to ${m * m}, but it isn't in the domain. Restricting the domain is what makes the answer unique.` },
      ],
    };
  }
  if (kind === 2) {
    const quad = r.next() >= 0.5;
    const f = quad ? quadratic(1, r.int(-6, 6)) : linear(r.coef(-5, 5), r.nonzero(-9, 9));
    const t = quad ? r.int(1, 4) : r.nonzero(-4, 4);
    const v = f.at(t);
    return {
      prompt: md`Let $f(x) = ${f.tex}$${quad ? md` with domain $x \ge 0$, so that $f$ is one-to-one` : ""}. The point $(a, ${t})$ lies on the graph of $f^{-1}$. Find $a$.`,
      answer: String(v),
      verify: [`a = ${f.txt(String(t))}`],
      hint: "The inverse swaps the coordinates of every point. Which point must then be on the graph of f?",
      solution: [
        { math: md`(a, ${t}) \text{ on } f^{-1} \iff (${t}, a) \text{ on } f`, note: "Inverse graphs have their coordinates swapped." },
        { math: md`a = f(${t}) = ${f.sub(String(t))} = ${v}`, note: md`So the point on $f^{-1}$ is $(${v}, ${t})$.` },
      ],
    };
  }
  const q = r.int(2, 5);
  const p = r.nonzero(-9, 9);
  const k = r.nonzero(-6, 6);
  return {
    prompt: md`Let $f(x) = \frac{${poly([[1, "x"], [p, ""]])}}{${q}}$. Find $f^{-1}(${k})$.`,
    answer: String(q * k - p),
    verify: [`(x + (${p}))/${q} = ${k}`],
    hint: md`Solve $f(x) = ${k}$: multiply by ${q} first.`,
    solution: [
      { math: md`\frac{${poly([[1, "x"], [p, ""]])}}{${q}} = ${k}`, note: md`The input that $f$ sends to ${k}.` },
      { math: md`${poly([[1, "x"], [p, ""]])} = ${q * k}`, note: md`Multiply by ${q}.` },
      { math: md`x = ${q * k - p}`, note: md`${p > 0 ? "Subtract" : "Add"} ${Math.abs(p)}.` },
    ],
  };
};

const oneToOne: Generator = (r) => {
  if (r.next() < 0.5) {
    const h = r.int(-3, 3);
    const k = r.int(-3, 3);
    const s = r.sign();
    const options: { expr: string; yes: boolean; why: string }[] = [
      { expr: `${r.nonzero(-3, 3)}*x + (${k})`, yes: true, why: "A non-horizontal line always rises or always falls, so each height is reached once." },
      { expr: `${s}*(x - (${h}))^2 + (${k})`, yes: false, why: md`A parabola turns at its vertex. Any horizontal line just ${s > 0 ? "above" : "below"} the vertex crosses it twice, at mirror-image inputs.` },
      { expr: `${s}*abs(x - (${h})) + (${k})`, yes: false, why: md`The V turns at its corner. A horizontal line just ${s > 0 ? "above" : "below"} the corner crosses both arms.` },
      { expr: `${s}*sqrt(x - (${h})) + (${k})`, yes: true, why: md`The half-parabola starts at $(${h}, ${k})$ and only ever ${s > 0 ? "rises" : "falls"}, so no height repeats.` },
      { expr: `(x - (${h}))^3/4 + (${k})`, yes: true, why: "This curve flattens out for a moment but never turns back, so it keeps rising: each height once." },
      { expr: `${s}*((x - (${h}))^3 - 6*(x - (${h})))/4 + (${k})`, yes: false, why: md`The curve ${s > 0 ? "rises, turns, falls, then turns and rises again" : "falls, turns, rises, then turns and falls again"}. A horizontal line through the middle crosses it three times.` },
    ];
    const o = r.pick(options);
    return {
      prompt: md`Is the function graphed one-to-one?`,
      figure: { kind: "plot", x: [-6, 6], y: [-6, 6], curves: [{ expr: o.expr }] },
      choices: ["yes", "no"],
      accept: [o.yes ? "yes" : "no"],
      hint: "Imagine sliding a horizontal line up and down the picture. Does it ever cross the graph more than once?",
      solution: [
        { math: o.yes ? md`\text{yes}` : md`\text{no}`, note: o.why },
        { math: o.yes ? md`\text{every horizontal line crosses at most once}` : md`\text{some horizontal line crosses more than once}`, note: o.yes ? "Different inputs always give different outputs, so f has an inverse." : "Two inputs share an output, so an undo machine couldn't know which one to return." },
      ],
    };
  }
  const h = r.int(-4, 4);
  const k = r.int(-6, 6);
  let t = r.int(h - 4, h + 4);
  while (t === h) t = r.int(h - 4, h + 4);
  const other = 2 * h - t;
  const v = (t - h) ** 2 + k;
  if (r.next() < 0.6) {
    const E = poly([[1, "x^2"], [-2 * h, "x"], [h * h + k, ""]]);
    return {
      prompt: md`Let $f(x) = ${E}$. Then $f(${t}) = ${v}$. Find a **different** input $x$ with $f(x) = ${v}$. This shows $f$ is not one-to-one.`,
      answer: String(other),
      verify: [`${E} = ${v}`],
      hint: md`Complete the square to find the axis of symmetry. Inputs the same distance from it have the same output.`,
      solution: [
        { math: md`f(x) = ${body("square", h).tex}${plusK(k)}`, note: h ? md`Complete the square: half of ${-2 * h} is ${-h}, and $${paren(-h)}^2 = ${h * h}$.` : "There is no x-term, so this is already in vertex form." },
        { math: md`x = ${h}`, note: "The axis of symmetry." },
        { math: md`${t} \text{ is } ${Math.abs(t - h)} \text{ ${t > h ? "right" : "left"} of } ${h}`, note: md`So the input ${Math.abs(t - h)} to the ${t > h ? "left" : "right"} of ${h} has the same output.` },
        { math: md`x = ${other}`, note: md`Check: $f(${other}) = ${h ? `(${other} ${signed(-h)})^2` : `${paren(other)}^2`}${plusK(k)} = ${v}$.` },
      ],
    };
  }
  const E = `|${shift(h)}|${plusK(k)}`;
  const absV = Math.abs(t - h) + k;
  return {
    prompt: md`Let $f(x) = ${E}$. Then $f(${t}) = ${absV}$. Find a **different** input $x$ with $f(x) = ${absV}$. This shows $f$ is not one-to-one.`,
    answer: String(other),
    verify: [`abs(${shift(h)})${plusK(k)} = ${absV}`],
    hint: md`$|${shift(h)}|$ is the distance from $x$ to ${h}. Which other input is the same distance away?`,
    solution: [
      { math: md`|${shift(h)}| = ${Math.abs(t - h)}`, note: md`${k ? `${k > 0 ? "Subtract" : "Add"} ${Math.abs(k)}` : "Start from the equation"}: $x$ must be ${Math.abs(t - h)} away from ${h}.` },
      { math: md`x = ${h} + ${Math.abs(t - h)} \text{ or } x = ${h} - ${Math.abs(t - h)}`, note: "One on each side." },
      { math: md`x = ${other}`, note: md`The one that isn't ${t}.` },
    ],
  };
};

// ── Lesson 4: Transformations of graphs ─────────────────────────────────────

const GENERIC: Record<Parent, string> = { square: "(x - h)^2", abs: "|x - h|", sqrt: "\\sqrt{x - h}" };

const readShift: Generator = (r) => {
  const p = r.pick<Parent>(["square", "abs", "sqrt"]);
  const s = r.sign();
  const askH = r.next() < 0.5;
  const h = p === "sqrt" ? r.int(-5, 1) : r.int(-3, 3);
  const k = p === "sqrt" ? r.int(-3, 3) : s > 0 ? r.int(-4, 2) : r.int(-2, 4);
  const f = shaped(p, s, h, k);
  const value = (x: number) => s * (p === "square" ? (x - h) ** 2 : p === "abs" ? Math.abs(x - h) : Math.sqrt(x - h)) + k;
  const d = p === "square" ? 1 : r.pick([1, 2]);
  const x0 = p === "sqrt" ? h + d * d : h + d;
  const y0 = value(x0);
  const pts = askH && p !== "sqrt" ? [h - d, h + d] : [x0];
  const sTxt = s < 0 ? "-" : "";
  let verify: string;
  if (askH && p === "square") verify = `(${h - d} - h)^2 = (${h + d} - h)^2`;
  else if (askH && p === "abs") verify = `abs(${h - d} - h) = abs(${h + d} - h)`;
  else if (askH) verify = `${sTxt}sqrt(${x0} - h) + (${k}) = ${y0}`;
  else verify = `${sTxt}${PARENT_TXT[p].replace("x", `(${x0} - (${h}))`)} + k = ${y0}`;
  const where = p === "sqrt" ? "starting point" : p === "abs" ? "corner" : "vertex";
  return {
    prompt: md`The dashed graph is $y = ${PARENT_TEX[p]}$. The solid graph is $y = ${s < 0 ? "-" : ""}${GENERIC[p]} + k$. Find $${askH ? "h" : "k"}$.`,
    figure: {
      kind: "plot",
      x: [-6, 6],
      y: [-6, 6],
      curves: [
        { expr: PARENT_TXT[p], color: 3, dashed: true },
        { expr: f.txt, color: 1 },
      ],
      points: [{ x: h, y: k, color: 2 }, ...pts.map((x) => ({ x, y: value(x), label: `(${x}, ${value(x)})` }))],
    },
    answer: String(askH ? h : k),
    verify: [verify],
    hint: md`The ${where} of $y = ${PARENT_TEX[p]}$ is at $(0, 0)$. In the solid graph it has moved to $(h, k)$.`,
    solution: [
      { math: md`(0, 0) \to (${h}, ${k})`, note: md`Read the ${where} of the solid graph from the grid. It is $(h, k)$, since the inside is 0 at $x = h$ and the output there is $k$.` },
      {
        math: askH && p !== "sqrt" ? md`(${h - d}, ${y0}) \text{ and } (${h + d}, ${y0})` : md`${f.tex.replace(/x/g, `(${x0})`)} = ${y0}`,
        note: askH && p !== "sqrt" ? md`Check with the marked points: they have the same height, so the axis of symmetry $x = h$ is halfway between them.` : md`Check: the marked point $(${x0}, ${y0})$ satisfies $y = ${f.tex}$.`,
      },
      { math: md`${askH ? "h" : "k"} = ${askH ? h : k}`, note: "" },
    ],
  };
};

const writeEquation: Generator = (r) => {
  const p = r.pick<Parent>(["square", "abs", "sqrt"]);
  let a = 1, h = 0, k = 0;
  do {
    // Never the parent itself: the prompt says the graph has moved.
    a = r.pick([1, -1, 1, -1, 2, -2]);
    h = p === "sqrt" ? r.int(-5, 2) : r.int(-3, 3);
    k = a > 0 ? r.int(-4, 2) : r.int(-2, 4);
  } while (a === 1 && h === 0 && k === 0);
  const f = shaped(p, a, h, k);
  const where = p === "sqrt" ? "starting point" : p === "abs" ? "corner" : "vertex";
  const example = p === "square" ? "y = 2(x - 1)^2 + 3" : p === "abs" ? "y = 2abs(x - 1) + 3" : "y = 2sqrt(x - 1) + 3";
  return {
    prompt: md`The dashed graph is $y = ${PARENT_TEX[p]}$. The solid graph is the same ${PARENT_NAME[p]} moved, and maybe flipped or stretched. Write its equation, typed like ${example}.`,
    figure: {
      kind: "plot",
      x: [-6, 6],
      y: [-6, 6],
      curves: [
        { expr: PARENT_TXT[p], color: 3, dashed: true },
        { expr: f.txt, color: 1 },
      ],
      points: [
        { x: h, y: k, color: 2 },
        { x: h + 1, y: a + k, label: `(${h + 1}, ${a + k})` },
      ],
    },
    answer: f.txt,
    hint: md`Find the ${where} $(h, k)$ first. Then compare one step to the right: on $y = ${PARENT_TEX[p]}$ the height goes up by 1, so on the solid graph it changes by $a$.`,
    solution: [
      { math: md`(h, k) = (${h}, ${k})`, note: md`The ${where} of the solid graph.` },
      { math: md`a = ${a + k} - ${paren(k)} = ${a}`, note: md`The marked point is 1 to the right of the ${where}. The parent rises 1 there, the solid graph changes by ${a}, so $a = ${a}$.` },
      { math: md`y = ${f.tex}`, note: md`Put $a$, $h$ and $k$ into $y = a${GENERIC[p]} + k$.` },
    ],
  };
};

const mapPoint: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 4) {
    const p = r.pick<Parent>(["square", "abs"]);
    const A = r.pick([2, 3, -1, -2]);
    const h = r.nonzero(-5, 5);
    const k = r.int(-9, 9);
    const t = r.int(-5, 5);
    const fv = p === "square" ? (t - h) ** 2 : Math.abs(t - h);
    const v = A * fv + k;
    return {
      prompt: md`Let $f(x) = ${PARENT_TEX[p]}$ and $g(x) = ${co(A)}f(${shift(h)})${plusK(k)}$. Find $g(${t})$.`,
      answer: String(v),
      verify: [`y = ${A}*${PARENT_TXT[p].replace("x", `(${t} - (${h}))`)} + (${k})`],
      hint: md`Work inside out: compute the input $${t} ${signed(-h)}$, apply $f$, then multiply by ${A}${k ? ` and ${k > 0 ? "add" : "subtract"} ${Math.abs(k)}` : ""}.`,
      solution: [
        { math: md`g(${t}) = ${co(A)}f(${t} ${signed(-h)})${plusK(k)} = ${co(A)}f(${t - h})${plusK(k)}`, note: "The inside change happens first." },
        { math: md`f(${t - h}) = ${fv}`, note: p === "square" ? "Square it." : "Take its absolute value." },
        { math: md`${A}(${fv})${plusK(k)} = ${v}`, note: "Then the outside changes: stretch, then shift." },
      ],
    };
  }
  // (p, q) on y = f(x) goes to (p/B + h, A q + k) on y = A f(B(x - h)) + k.
  let A = 1, Bn = 1, Bd = 1, h = 0, k = 0;
  if (kind === 0) {
    h = r.nonzero(-5, 5);
    k = r.nonzero(-5, 5);
  } else if (kind === 1) {
    A = r.pick([2, 3, -1, -2]);
    k = r.int(-5, 5);
  } else if (kind === 2) {
    [Bn, Bd] = r.pick([[2, 1], [3, 1], [-1, 1], [1, 2]] as const);
  } else {
    A = r.pick([2, -1, 3]);
    Bn = r.pick([2, -1]);
    h = r.nonzero(-4, 4);
    k = r.nonzero(-5, 5);
  }
  const q = r.int(-5, 5);
  const p = Bn * r.int(-4, 4) || Bn * 2;
  const X = (p * Bd) / Bn + h;
  const Y = A * q + k;
  const bTex = Bd === 2 ? "\\tfrac{1}{2}" : co(Bn);
  const bTxt = Bd === 2 ? "(1/2)" : `(${Bn})`;
  const inside = Bn === 1 && Bd === 1 ? (h ? shift(h) : "x") : h ? `${bTex}(${shift(h)})` : `${bTex}x`;
  const rule = md`y = ${co(A)}f(${inside})${plusK(k)}`;
  const steps: Step[] = [];
  if (Bn !== 1 || Bd !== 1 || h !== 0) {
    steps.push({
      math: md`${Bn === 1 && Bd === 1 ? shift(h) : inside} = ${p} \quad\Rightarrow\quad x = ${X}`,
      note: md`The new graph has the old height $f(${p})$ where its inside equals ${p}. Solve for $x$: inside changes run backwards.`,
    });
  } else steps.push({ math: md`x = ${p}`, note: "Nothing changes inside, so the input stays the same." });
  steps.push({
    math: A === 1 && k === 0 ? md`y = ${q}` : md`y = ${A === 1 ? String(q) : `${A}(${q})`}${plusK(k)} = ${Y}`,
    note: A === 1 && k === 0 ? "Nothing changes outside, so the height stays the same." : md`The outside changes act on the old height $f(${p}) = ${q}$ directly${A !== 1 ? `: multiply by ${A}` : ""}${k ? `${A !== 1 ? ", then" : ":"} ${k > 0 ? `add ${k}` : `subtract ${-k}`}` : ""}.`,
  });
  steps.push({ math: md`(${X}, ${Y})`, note: "The image point." });
  return {
    prompt: md`The point $(${p}, ${q})$ is on the graph of $y = f(x)$. Which point must be on the graph of $${rule}$? Write it as a point, like (2, -1).`,
    answer: `(${X}, ${Y})`,
    form: "tuple",
    verify: [`${bTxt}*(a - (${h})) + (b - (${k}))/(${A}) = ${p + q}`, `${bTxt}*(a - (${h})) - (b - (${k}))/(${A}) = ${p - q}`],
    hint: "Inside the parentheses, ask which x makes the inside equal the old input. Outside, apply the changes to the old height directly.",
    solution: steps,
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit1: Unit = {
  title: "Functions in Depth",
  lessons: [
    {
      id: "domain-and-range",
      title: "Domain and range",
      summary: "Which inputs a rule can accept, which outputs it can produce, and how to prove you have found them all.",
      blocks: [
        {
          kind: "text",
          body: md`In Algebra 1 a function was a rule that gives each input exactly one output. Most of those rules accepted any number at all, so the set of allowed inputs hardly mattered. Now it will, because some rules break on some inputs.

Try $f(x) = \frac{1}{x - 2}$ at $x = 2$. The rule asks for $\frac{1}{0}$, and there is no such number. So 2 is not a legal input for this $f$.`,
        },
        {
          kind: "key",
          title: "Domain and range",
          body: md`- The **domain** of $f$ is the set of inputs $x$ for which $f(x)$ is defined.
- The **range** of $f$ is the set of all outputs $f(x)$, as $x$ runs through the domain.

When a function is given only by a formula, its domain is every real number for which the formula gives a real number. This is its **natural domain**. A problem can also restrict the domain on purpose, as in "$f(x) = 2x$ for $0 \le x \le 5$".`,
        },
        {
          kind: "why",
          title: "Why only two things can go wrong",
          body: md`Adding, subtracting and multiplying real numbers always gives a real number. So does a whole-number power, which is repeated multiplication. A formula built only from those works for every $x$. So far, just two operations can fail:

- **Dividing by zero.** If $\frac{6}{0}$ were a number $q$, then $q \cdot 0 = 6$. But $q \cdot 0 = 0$ for every $q$, so no number works. (And $\frac{0}{0}$ fails the other way: every $q$ satisfies $q \cdot 0 = 0$, so there is no single answer.)
- **Square roots of negatives.** $\sqrt{a}$ is the number $\ge 0$ whose square is $a$. A square is never negative, since positive times positive and negative times negative are both positive. So no real number squares to $-4$.

To find a domain, look for denominators (they can't be 0) and square roots (the inside must be $\ge 0$). Later units add a little: other even roots (Unit 5) behave like square roots, and logarithms (Unit 6) need positive inputs.`,
        },
        {
          kind: "key",
          title: "Writing sets of numbers",
          body: md`Domains and ranges are sets of numbers. Write them in interval notation, as in Algebra 1, Unit 3:

- $[a, b]$ includes both ends and $(a, b)$ includes neither. A bracket includes, a parenthesis leaves out.
- $(-\infty, \infty)$ is every real number. Infinity always gets a parenthesis.
- $\cup$ (union) joins pieces: $(-\infty, 2) \cup (2, \infty)$ is every number except 2.

Type $\infty$ as **inf** and $\cup$ as a capital **U**, as in (-inf, 2) U (2, inf).`,
        },
        {
          kind: "example",
          title: "A square root",
          problem: md`Find the domain of $f(x) = \sqrt{2x - 6}$.`,
          steps: [
            { math: md`2x - 6 \ge 0`, note: "The radicand (the expression under the root) must be 0 or more." },
            { math: md`2x \ge 6`, note: "Add 6 to both sides." },
            { math: md`x \ge 3`, note: "Divide by 2. It's positive, so the inequality keeps its direction." },
            { math: md`[3, \infty)`, note: md`A bracket at 3: $f(3) = \sqrt{0} = 0$ is perfectly fine.` },
          ],
        },
        {
          kind: "numberline",
          range: [-2, 8],
          intervals: [{ from: 3, to: null }],
          caption: md`The domain of $\sqrt{2x - 6}$: 3 and everything to its right.`,
        },
        {
          kind: "example",
          title: "A denominator",
          problem: md`Find the domain of $f(x) = \frac{x + 1}{x^2 - 9}$.`,
          steps: [
            { math: md`x^2 - 9 = 0`, note: "Find the inputs that make the denominator 0. Those are the only trouble." },
            { math: md`(x - 3)(x + 3) = 0`, note: "Difference of squares (Algebra 1, Unit 7)." },
            { math: md`x = 3 \text{ or } x = -3`, note: "Zero product property." },
            { math: md`(-\infty, -3) \cup (-3, 3) \cup (3, \infty)`, note: md`Everything else. The numerator doesn't matter: $\frac{0}{8} = 0$ is a fine output.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the domain of $f(x) = \frac{5}{x - 4}$. ${FMT}`,
          form: "inequality",
          answer: "(-inf, 4) U (4, inf)",
          explain: md`Only $x = 4$ makes the denominator 0. Everything else works: $(-\infty, 4) \cup (4, \infty)$.`,
        },
        {
          kind: "text",
          body: md`**Ranges** take more thought. The domain asks "does the rule work here?", one input at a time. The range asks which outputs actually happen. A number $c$ is in the range exactly when the equation $f(x) = c$ has a solution in the domain. So a range question is a whole family of equations, one for each $c$.

On a graph, $f(x) = c$ asks where the horizontal line $y = c$ meets the curve.`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 6],
          curves: [
            { expr: "(x - h)^2 + k", label: "y = (x - h)^2 + k" },
            { expr: "c", label: "y = c", color: 2, dashed: true },
          ],
          points: [{ x: "h", y: "k", label: "(h, k) = ({h}, {k})", color: 2 }],
          params: [
            { name: "h", min: -3, max: 3, step: 1, value: 1 },
            { name: "k", min: -4, max: 2, step: 1, value: -2 },
            { name: "c", min: -6, max: 6, step: 0.5, value: 1 },
          ],
          caption: md`Slide $c$. The line $y = c$ meets the parabola exactly when $c \ge k$. Those heights are the range. Below the vertex the line misses, so those outputs never happen.`,
        },
        {
          kind: "proof",
          title: "The range of a shifted square",
          given: md`$f(x) = (x - h)^2 + k$, with domain all real numbers`,
          prove: md`The range of $f$ is $[k, \infty)$`,
          steps: [
            { statement: md`For every $x$, $(x - h)^2 \ge 0$`, reason: "A square is never negative" },
            { statement: md`For every $x$, $f(x) \ge k$`, reason: md`Add $k$ to both sides. So no output lies below $k$.` },
            { statement: md`Let $c \ge k$. Then $\sqrt{c - k}$ is a real number`, reason: md`$c - k \ge 0$, and square roots of such numbers exist` },
            { statement: md`$f(h + \sqrt{c - k}) = (\sqrt{c - k})^2 + k = c$`, reason: md`Substitute: the input minus $h$ is $\sqrt{c - k}$. So every $c \ge k$ is an output.` },
            { statement: md`The range is exactly $[k, \infty)$`, reason: "Step 2 rules out everything below k; step 4 reaches everything from k up" },
          ],
        },
        {
          kind: "why",
          title: "Why a range needs both halves",
          body: md`Step 2 alone shows only that the range sits *inside* $[k, \infty)$. It could still have gaps. Step 4 rules gaps out by naming an input for every height.

The function $f(x) = \frac{1}{x - 2} + 3$ shows why the second half matters. Solve $y = \frac{1}{x - 2} + 3$ for $x$: subtract 3, then take reciprocals, to get $x = 2 + \frac{1}{y - 3}$. That gives an input for every $y$ **except** $y = 3$. And 3 truly is missed, since $\frac{1}{x - 2}$ is never 0. So the range is $(-\infty, 3) \cup (3, \infty)$, with a one-point gap that "outputs can be anything" would have missed.`,
        },
        {
          kind: "plot",
          x: [-3, 4],
          y: [-1, 5],
          curves: [{ expr: "x^2", label: "y = x^2,\\; -1 \\le x \\le 2", domain: [-1, 2] }],
          points: [
            { x: -1, y: 1, label: "(-1, 1)" },
            { x: 2, y: 4, label: "(2, 4)" },
            { x: 0, y: 0, label: "\\text{vertex } (0, 0)", color: 2 },
          ],
          caption: md`With a restricted domain, check the ends **and** any turning point between them. Here the ends give 1 and 4, but the graph dips to 0 at the vertex, so the range is $[0, 4]$, not $[1, 4]$.`,
        },
        {
          kind: "check",
          prompt: md`Find the range of $f(x) = -(x + 1)^2 + 4$. ${FMT}`,
          form: "inequality",
          answer: "(-inf, 4]",
          explain: md`$-(x + 1)^2$ is never positive, so $f(x) \le 4$, with 4 reached at $x = -1$. Every lower height is reached too, so the range is $(-\infty, 4]$.`,
        },
      ],
      practice: [domainOf, excludedValues, rangeOf],
    },
    {
      id: "function-notation-and-composition",
      title: "Function notation and composition",
      summary: "What goes inside f( ) and what happens outside it, and how to chain functions so one's output feeds the next.",
      blocks: [
        {
          kind: "text",
          body: md`In $f(x) = x^2 - 3x$, the letter $x$ is a placeholder. The rule really says: *square the input, then subtract 3 times the input*. Anything can go in the input slot: a number, a letter, an expression, or the output of another function.`,
        },
        {
          kind: "key",
          title: "Substituting into a function",
          body: md`$f(\text{anything})$ means: replace **every** $x$ in the rule with (anything), in parentheses.

With $f(x) = x^2 - 3x$:
- $f(a + 1) = (a + 1)^2 - 3(a + 1)$
- $f(2x) = (2x)^2 - 3(2x) = 4x^2 - 6x$`,
        },
        {
          kind: "example",
          title: "Inside versus outside",
          problem: md`Let $f(x) = x^2 - 3x$. Find $f(x + 1)$ and $f(x) + 1$.`,
          steps: [
            { math: md`f(x + 1) = (x + 1)^2 - 3(x + 1)`, note: md`Replace each $x$ with $(x + 1)$.` },
            { math: md`= x^2 + 2x + 1 - 3x - 3`, note: "Expand (Algebra 1, Unit 6)." },
            { math: md`= x^2 - x - 2`, note: "Combine like terms." },
            { math: md`f(x) + 1 = x^2 - 3x + 1`, note: "Here the 1 is added after the rule has finished." },
          ],
        },
        {
          kind: "why",
          title: "Why f(x + 1) and f(x) + 1 differ",
          body: md`The parentheses mark what goes **into** the function. $f(x + 1)$ changes the input before the rule acts. $f(x) + 1$ changes the output after. Test at $x = 2$: $f(3) = 0$, but $f(2) + 1 = -1$.

For the same reason $f(a + b)$ is usually not $f(a) + f(b)$. With $f(x) = x^2$, $f(1 + 2) = 9$ while $f(1) + f(2) = 5$. Function notation is not multiplication, so there is no distributive law for it.`,
        },
        {
          kind: "check",
          prompt: md`Let $f(x) = x^2 + 2x$. Find $f(x - 1)$, multiplied out.`,
          answer: "x^2 - 1",
          expanded: true,
          explain: md`$(x - 1)^2 + 2(x - 1) = x^2 - 2x + 1 + 2x - 2 = x^2 - 1$.`,
        },
        {
          kind: "text",
          body: md`Functions can be chained. Say $g$ turns hours into minutes, $g(x) = 60x$, and $f$ gives the cost in dollars of parking for $m$ minutes, $f(m) = 0.05m + 2$. The cost of parking for $x$ hours is

$$f(g(x)) = 0.05(60x) + 2 = 3x + 2.$$

The output of $g$ became the input of $f$. Building a new function this way is called **composition**.`,
        },
        {
          kind: "key",
          title: "Composition",
          body: md`$$(f \circ g)(x) = f(g(x))$$

Read it "$f$ of $g$ of $x$" or "$f$ after $g$". Work from the inside out: apply $g$ first, then apply $f$ to the result.

The domain of $f \circ g$ is every $x$ in the domain of $g$ for which $g(x)$ is in the domain of $f$. Both machines have to accept what they are fed.`,
        },
        {
          kind: "example",
          title: "One number through two machines",
          problem: md`Let $f(x) = x^2 + 1$ and $g(x) = 3x - 2$. Find $f(g(2))$ and $g(f(2))$.`,
          steps: [
            { math: md`g(2) = 3(2) - 2 = 4`, note: "Inside first." },
            { math: md`f(g(2)) = f(4) = 4^2 + 1 = 17`, note: "Feed that output to f." },
            { math: md`f(2) = 5, \quad g(f(2)) = g(5) = 13`, note: "The other order gives a different answer." },
          ],
        },
        {
          kind: "example",
          title: "Composing the rules themselves",
          problem: md`With the same $f$ and $g$, find $f(g(x))$ and $g(f(x))$.`,
          steps: [
            { math: md`f(g(x)) = (3x - 2)^2 + 1`, note: md`The whole of $g(x)$ goes in place of $x$ in $f$.` },
            { math: md`= 9x^2 - 12x + 5`, note: md`Expand. Check at $x = 2$: $36 - 24 + 5 = 17$, as before.` },
            { math: md`g(f(x)) = 3(x^2 + 1) - 2 = 3x^2 + 1`, note: md`Check at $x = 2$: $12 + 1 = 13$.` },
          ],
        },
        {
          kind: "why",
          title: "Why order matters",
          body: md`$f \circ g$ and $g \circ f$ use the same two machines in different orders. In $f(g(x))$ the squaring happens to $3x - 2$. In $g(f(x))$ the tripling happens to $x^2 + 1$. Socks then shoes is not the same as shoes then socks. Composition is usually **not** commutative.

It is associative, though. $(f \circ g) \circ h$ and $f \circ (g \circ h)$ both mean: apply $h$, then $g$, then $f$. So $f(g(h(x)))$ needs no extra brackets.`,
        },
        {
          kind: "proof",
          title: "Composing two linear functions",
          given: md`$f(x) = mx + b$ and $g(x) = nx + c$`,
          prove: md`$f \circ g$ is linear, with slope $mn$`,
          steps: [
            { statement: md`$f(g(x)) = m \cdot g(x) + b$`, reason: md`Definition of $f$, with $g(x)$ as the input` },
            { statement: md`$= m(nx + c) + b$`, reason: md`Substitute the rule for $g$` },
            { statement: md`$= (mn)x + (mc + b)$`, reason: "Distributive property, then group the constants" },
            { statement: md`$f \circ g$ is linear with slope $mn$ and $y$-intercept $mc + b$`, reason: "It has the slope-intercept form Mx + B (Algebra 1, Unit 4)" },
          ],
        },
        {
          kind: "why",
          title: "Why the slopes multiply",
          body: md`Slope is a rate: how much the output changes per unit of input. A step of 1 in $x$ changes $g(x)$ by $n$. A change of $n$ in $f$'s input changes $f$'s output by $m$ for each unit, so by $mn$ in all. Rates in a chain multiply: 60 minutes per hour times 0.05 dollars per minute is 3 dollars per hour, the slope of $3x + 2$ above.`,
        },
        {
          kind: "example",
          title: "The domain of a composition",
          problem: md`Let $f(x) = \sqrt{x}$ and $g(x) = x - 5$. Find the domains of $f(g(x))$ and $g(f(x))$.`,
          steps: [
            { math: md`f(g(x)) = \sqrt{x - 5}`, note: md`$f$ only accepts inputs $\ge 0$, and its input is $x - 5$.` },
            { math: md`x - 5 \ge 0 \;\Rightarrow\; [5, \infty)`, note: "So the composition needs x at least 5." },
            { math: md`g(f(x)) = \sqrt{x} - 5 \;\Rightarrow\; [0, \infty)`, note: md`Now the root acts on $x$ itself, and $g$ accepts anything.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Let $f(x) = \sqrt{x}$ and $g(x) = x + 3$. Find the domain of $f(g(x))$. ${FMT}`,
          form: "inequality",
          answer: "[-3, inf)",
          explain: md`$f(g(x)) = \sqrt{x + 3}$ needs $x + 3 \ge 0$, so $x \ge -3$: $[-3, \infty)$.`,
        },
        {
          kind: "check",
          prompt: md`Let $f(x) = 2x + 1$ and $g(x) = x^2$. Find $f(g(3))$.`,
          answer: "19",
          explain: md`$g(3) = 9$, then $f(9) = 19$. (The other order gives $g(f(3)) = g(7) = 49$.)`,
        },
      ],
      practice: [composeValue, composeExpr, solveNotation],
    },
    {
      id: "inverse-functions",
      title: "Inverse functions",
      summary: "Undoing a function: when it can be done, how to find the formula, and why the graph reflects across y = x.",
      blocks: [
        {
          kind: "text",
          body: md`Sometimes you know a function's output and want the input back. $f(x) = 2x + 3$ doubles, then adds 3. To undo it, subtract 3, then halve. The steps run in reverse order, as when you solved equations in Algebra 1, Unit 2. That undo machine is $\frac{x - 3}{2}$.`,
        },
        {
          kind: "key",
          title: "Inverse function",
          body: md`The **inverse** of $f$, written $f^{-1}$, sends each output of $f$ back to the input that produced it:

$$f^{-1}(b) = a \quad\text{exactly when}\quad f(a) = b.$$

So $f^{-1}(f(x)) = x$ for every $x$ in the domain of $f$, and $f(f^{-1}(x)) = x$ for every $x$ in the range of $f$. The domain and range trade places.

The $-1$ is not an exponent: $f^{-1}(x)$ is not $\frac{1}{f(x)}$.`,
        },
        {
          kind: "why",
          title: "Why some functions have no inverse",
          body: md`Take $f(x) = x^2$. Both $f(3)$ and $f(-3)$ are 9. Asked to undo 9, an inverse would have to return 3 *and* $-3$: two outputs for one input. That isn't a function.

So an inverse exists exactly when no two inputs share an output. Such a function is **one-to-one**: whenever $f(a) = f(b)$, it must be that $a = b$.`,
        },
        {
          kind: "key",
          title: "Horizontal line test",
          body: md`A function is one-to-one exactly when no horizontal line crosses its graph more than once.`,
        },
        {
          kind: "plot",
          x: [-5, 5],
          y: [-4, 6],
          curves: [
            { expr: "x^2 - 2", label: "y = x^2 - 2" },
            { expr: "c", label: "y = c", color: 2, dashed: true },
          ],
          params: [{ name: "c", min: -4, max: 6, step: 0.5, value: 2 }],
          caption: md`Slide $c$. For every $c > -2$ the line crosses twice, at mirror-image inputs $\pm\sqrt{c + 2}$. Two inputs, one output: $y = x^2 - 2$ is not one-to-one.`,
        },
        {
          kind: "why",
          title: "Why the horizontal line test works",
          body: md`The line $y = c$ meets the graph at exactly the points whose output is $c$. Two crossings mean two different inputs with the same output, which is what one-to-one forbids. It's the vertical line test from Algebra 1, Unit 4, turned on its side, because an inverse swaps the roles of input and output.

A function that fails can often be repaired by cutting down its domain. On $x \ge 0$, $x^2$ passes the test, and its inverse is $\sqrt{x}$. That's exactly why $\sqrt{9}$ means 3 and not $-3$: the square root is the inverse of squaring on $x \ge 0$.`,
        },
        {
          kind: "why",
          title: "Why you swap x and y",
          body: md`The inverse swaps every pair. If $(a, b)$ is on the graph of $f$, then $(b, a)$ is on the graph of $f^{-1}$. So to find a formula, write $y = f(x)$, swap the letters $x$ and $y$ (that swaps every pair at once), then solve for $y$.

Geometry, Unit 9 showed that swapping coordinates is reflecting across the line $y = x$. Here is that proof again, since it is what makes the graphs of $f$ and $f^{-1}$ mirror images.`,
        },
        {
          kind: "example",
          title: "A linear function",
          problem: md`Find the inverse of $f(x) = 3x - 4$.`,
          steps: [
            { math: md`y = 3x - 4`, note: "Write the output as y." },
            { math: md`x = 3y - 4`, note: "Swap x and y." },
            { math: md`x + 4 = 3y`, note: "Add 4." },
            { math: md`f^{-1}(x) = \frac{x + 4}{3}`, note: "Divide by 3." },
            { math: md`f^{-1}(f(x)) = \frac{(3x - 4) + 4}{3} = x \;\checkmark`, note: "Check: the undo machine really undoes f." },
          ],
        },
        {
          kind: "example",
          title: "A fraction",
          problem: md`Find the inverse of $f(x) = \frac{x + 1}{x - 2}$.`,
          steps: [
            { math: md`x = \frac{y + 1}{y - 2}`, note: "Write y = f(x), then swap." },
            { math: md`xy - 2x = y + 1`, note: md`Multiply both sides by $y - 2$ and distribute.` },
            { math: md`xy - y = 2x + 1`, note: "Every y-term on one side." },
            { math: md`y(x - 1) = 2x + 1`, note: "Factor out y (Algebra 1, Unit 7)." },
            { math: md`f^{-1}(x) = \frac{2x + 1}{x - 1}`, note: md`Divide. $f$ never outputs 1: $\frac{x + 1}{x - 2} = 1$ would need $x + 1 = x - 2$, that is $1 = -2$. So its inverse refuses the input 1: range and domain trading places.` },
          ],
        },
        {
          kind: "proof",
          title: "Swapping coordinates is reflecting across y = x",
          given: md`Points $P(a, b)$ and $P'(b, a)$, with $a \ne b$`,
          prove: md`$P'$ is the reflection of $P$ across the line $y = x$`,
          steps: [
            { statement: md`The midpoint of $\overline{PP'}$ is $\left(\frac{a + b}{2}, \frac{a + b}{2}\right)$`, reason: "Midpoint formula" },
            { statement: md`The midpoint lies on $y = x$`, reason: "Its two coordinates are equal" },
            { statement: md`The slope of $\overline{PP'}$ is $\frac{a - b}{b - a} = -1$`, reason: md`Slope formula, and $a - b = -(b - a)$` },
            { statement: md`$\overline{PP'}$ is perpendicular to $y = x$`, reason: "The slopes -1 and 1 multiply to -1 (Algebra 1, Unit 4)" },
            { statement: md`$y = x$ is the perpendicular bisector of $\overline{PP'}$`, reason: "Steps 2 and 4" },
            { statement: md`$P'$ is the reflection of $P$ across $y = x$`, reason: "Definition of a reflection: the mirror line is the perpendicular bisector of the segment joining a point to its image" },
          ],
        },
        {
          kind: "plot",
          x: [-5, 5],
          y: [-5, 5],
          curves: [
            { expr: "x", label: "y = x", color: 3, dashed: true },
            { expr: "2x + 1", label: "y = f(x) = 2x + 1", color: 1 },
            { expr: "(x - 1)/2", label: "y = f^{-1}(x) = \\frac{x - 1}{2}", color: 2 },
          ],
          points: [
            { x: "c", y: "2c + 1", label: "P({c}, {=2c + 1})", color: 1 },
            { x: "2c + 1", y: "c", label: "P'({=2c + 1}, {c})", color: 2 },
          ],
          params: [{ name: "c", min: -2.5, max: 2, step: 0.5, value: 1 }],
          caption: md`Slide $c$. Each point of $f$ has a partner on $f^{-1}$ with its coordinates swapped, the mirror image across $y = x$. So the whole graph of $f^{-1}$ is the graph of $f$ reflected in that line.`,
        },
        {
          kind: "check",
          prompt: md`Find the inverse of $f(x) = 5x - 2$. Write $f^{-1}(x)$ as an expression in $x$.`,
          answer: "(x + 2)/5",
          explain: md`Swap: $x = 5y - 2$. Add 2, divide by 5: $f^{-1}(x) = \frac{x + 2}{5}$.`,
        },
        {
          kind: "check",
          prompt: md`Let $f(x) = x^3 + 1$. Find $f^{-1}(9)$.`,
          answer: "2",
          explain: md`$f^{-1}(9)$ is the input with $f(x) = 9$. So $x^3 = 8$, and $x = 2$. There is no other: a bigger input always has a bigger cube (negatives cube to negatives), so $x^3$ passes the horizontal line test.`,
        },
      ],
      practice: [inverseFormula, inverseValue, oneToOne],
    },
    {
      id: "transformations-of-graphs",
      title: "Transformations of graphs",
      summary: "How a f(b(x - h)) + k moves, flips and stretches the graph of f, and why the changes inside the parentheses run backwards.",
      blocks: [
        {
          kind: "text",
          body: md`In Algebra 1, Unit 8, vertex form $y = a(x - h)^2 + k$ moved and stretched the parabola $y = x^2$. Nothing there was special to parabolas. The same numbers move any graph, and once you see why, you can sketch $y = -2\sqrt{x + 3} + 1$ without a table.

The test shapes in this lesson are three **parent functions**: $y = x^2$, $y = |x|$ and $y = \sqrt{x}$. $|x|$ is $x$ when $x \ge 0$ and $-x$ when $x < 0$, so its graph is two half-lines of slope 1 and $-1$ meeting at the origin: a V. $\sqrt{x}$ is the inverse of $x^2$ on $x \ge 0$, so its graph is the right half of the parabola reflected in $y = x$ (Lesson 3).`,
        },
        {
          kind: "key",
          title: "The four moves",
          body: md`Start from $y = f(x)$.

- $y = f(x) + k$: shift **up** by $k$ (down if $k < 0$).
- $y = f(x - h)$: shift **right** by $h$ (left if $h < 0$).
- $y = a f(x)$: stretch vertically by a factor of $|a|$ (a squash when $|a| < 1$). If $a < 0$, also flip over the $x$-axis.
- $y = f(bx)$: squeeze horizontally by a factor of $|b|$ (a stretch when $|b| < 1$), dividing every $x$-coordinate by $b$. If $b < 0$, also flip over the $y$-axis.

All together, $y = a f(b(x - h)) + k$ sends each point $(p, q)$ of $f$ to $\left(\frac{p}{b} + h,\; aq + k\right)$.`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 6],
          curves: [
            { expr: "abs(x)", label: "y = |x|", color: 3, dashed: true },
            { expr: "a*abs(x - h) + k", label: "y = a|x - h| + k", color: 1 },
          ],
          points: [{ x: "h", y: "k", label: "\\text{corner } ({h}, {k})", color: 2 }],
          params: [
            { name: "a", min: -3, max: 3, step: 0.5, value: 2 },
            { name: "h", min: -4, max: 4, step: 1, value: 2 },
            { name: "k", min: -4, max: 4, step: 1, value: -1 },
          ],
          caption: md`The corner of $|x|$ rides to $(h, k)$. Make $a$ negative and the V flips; make $|a|$ bigger and the arms get steeper. At $a = 0$ it flattens to the line $y = k$.`,
        },
        {
          kind: "why",
          title: "Why the outside changes act directly",
          body: md`The $a$ and the $+k$ act *after* $f$ has done its work, on the output. Adding $k$ to every output lifts every point by $k$. Multiplying every output by $a$ moves each point to $a$ times its height: points on the $x$-axis stay put, and the rest move away from it, or across it when $a < 0$.`,
        },
        {
          kind: "why",
          title: "Why x - h shifts right",
          body: md`Algebra 1, Unit 8 gave this argument for $(x - h)^2$. Here it is for any $f$. An inside change acts on the input, *before* $f$. Take a point $(p, q)$ on $y = f(x)$, so $f(p) = q$. The new graph $y = f(x - h)$ reaches the same height $q$ when its input satisfies $x - h = p$, that is, at $x = p + h$. Every height arrives $h$ units **later**, so the graph moves right.

The same reasoning explains $f(bx)$. It reaches height $q$ when $bx = p$, at $x = \frac{p}{b}$. With $b = 2$ everything happens twice as soon, so the graph squeezes toward the $y$-axis. Inside changes run backwards because you are solving for the input.

Both at once: $y = f(b(x - h))$ reaches height $q$ when $b(x - h) = p$, so $x - h = \frac{p}{b}$ and $x = \frac{p}{b} + h$. Divide by $b$ first, then add $h$.`,
        },
        {
          kind: "proof",
          title: "Translating a graph",
          given: md`A function $f$, numbers $h$ and $k$, and $g(x) = f(x - h) + k$`,
          prove: md`$(p, q)$ is on the graph of $f$ exactly when $(p + h, q + k)$ is on the graph of $g$`,
          steps: [
            { statement: md`$g(p + h) = f((p + h) - h) + k = f(p) + k$`, reason: md`Definition of $g$, then simplify the input` },
            { statement: md`$(p + h, q + k)$ is on $g$ exactly when $g(p + h) = q + k$`, reason: "A point is on a graph when its height is the output at its input" },
            { statement: md`That happens exactly when $f(p) + k = q + k$`, reason: "Step 1" },
            { statement: md`That happens exactly when $f(p) = q$`, reason: md`Subtract $k$ (and adding $k$ undoes it)` },
            { statement: md`That happens exactly when $(p, q)$ is on the graph of $f$`, reason: md`Definition of the graph of $f$` },
          ],
        },
        {
          kind: "example",
          title: "Reading a transformation",
          problem: md`Describe the graph of $y = -2|x + 1| + 3$.`,
          steps: [
            { math: md`y = -2|x - (-1)| + 3`, note: md`Match $a f(x - h) + k$: $a = -2$, $h = -1$, $k = 3$.` },
            { math: md`(0, 0) \to (-1, 3)`, note: "The corner of |x| moves left 1 and up 3." },
            { math: md`(1, 1) \to (1 + (-1),\; -2(1) + 3) = (0, 1)`, note: md`Another parent point, sent by $(p, q) \to (p + h, aq + k)$.` },
            { math: md`-2|0 + 1| + 3 = 1 \;\checkmark`, note: "The image point really is on the graph." },
            { math: md`\text{opens down, twice as steep}`, note: md`$a < 0$ flips the V; $|a| = 2$ doubles the steepness of each arm.` },
          ],
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 6],
          curves: [
            { expr: "sqrt(x)", label: "y = \\sqrt{x}", color: 3, dashed: true },
            { expr: "a*sqrt(b*(x - h)) + k", label: "y = a\\sqrt{b(x - h)} + k", color: 1 },
          ],
          points: [{ x: "h", y: "k", label: "\\text{start } ({h}, {k})", color: 2 }],
          params: [
            { name: "a", min: -3, max: 3, step: 0.5, value: 1 },
            { name: "b", min: -3, max: 3, step: 0.5, value: 2 },
            { name: "h", min: -4, max: 4, step: 1, value: -2 },
            { name: "k", min: -4, max: 4, step: 1, value: -1 },
          ],
          caption: md`Drag $b$. Values above 1 squeeze the curve toward its start; values between 0 and 1 stretch it out. A negative $b$ flips it to point left, since $\sqrt{b(x - h)}$ then needs $x \le h$. At $b = 0$ (or $a = 0$) the graph collapses to the flat line $y = k$.`,
        },
        {
          kind: "why",
          title: "Why you factor out b first",
          body: md`In $y = \sqrt{2x - 6}$ the shift is not 6. Factor: $\sqrt{2x - 6} = \sqrt{2(x - 3)}$. The graph is $\sqrt{x}$ squeezed by 2, then moved right 3. Check it: the curve starts where the inside is 0, and $2x - 6 = 0$ at $x = 3$.

The shift is always the input that makes the inside 0. That input is $h$ only once $b$ has been factored out.`,
        },
        {
          kind: "example",
          title: "Writing an equation",
          problem: md`The graph of $y = \sqrt{x}$ is flipped over the $x$-axis, then moved left 3 and down 2. Write its equation.`,
          steps: [
            { math: md`y = -\sqrt{x}`, note: "Flip: multiply every output by -1." },
            { math: md`y = -\sqrt{x + 3}`, note: md`Left 3 means $h = -3$, so $x - h = x + 3$.` },
            { math: md`y = -\sqrt{x + 3} - 2`, note: md`Down 2 means $k = -2$.` },
            { math: md`x = -3: \; y = -\sqrt{0} - 2 = -2`, note: md`Check: the start $(0, 0)$ should land at $(-3, -2)$, and it does.` },
          ],
        },
        {
          kind: "check",
          prompt: md`The point $(4, 2)$ is on the graph of $y = f(x)$. Which point must be on the graph of $y = f(x + 1) - 3$? Write it as a point, like (2, -1).`,
          form: "tuple",
          answer: "(3, -1)",
          explain: md`Inside: $x + 1 = 4$ at $x = 3$, so the point moves left 1. Outside: the height drops by 3, to $-1$.`,
        },
        {
          kind: "check",
          prompt: md`Write the equation of $y = |x|$ moved right 2 and up 5. Type it like y = abs(x - 1) + 2.`,
          answer: "abs(x - 2) + 5",
          explain: md`Right 2 is $h = 2$, so the inside is $x - 2$. Up 5 adds 5 outside: $y = |x - 2| + 5$.`,
        },
      ],
      practice: [readShift, writeEquation, mapPoint],
    },
  ],
};
