import { frac, fracTex, paren, poly, signed } from "../../math/random";
import type { Rng } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Shared helpers ──────────────────────────────────────────────────────────

const FMT = md`Answer in interval notation, typing inf for $\infty$ and U for $\cup$, as in [2, inf) or (-inf, 3) U (3, inf). An inequality is fine too.`;

/** Typed answers that mean "every real number". */
const REALS = ["all real numbers", "all reals", "all numbers", "every real number", "any real number", "R"];

/** x - h, written nicely. */
const shift = (h: number) => poly([[1, "x"], [-h, ""]]);
/** " + k" or "" when k is 0. */
const plusK = (k: number) => (k ? ` ${signed(k)}` : "");
/** Replace every x in typed text by (value). */
const at = (text: string, v: number | string) => text.replace(/x/g, `(${v})`);
/** "x - h" with x replaced by a number: "(-3) + 5", or just "4" when h is 0. */
const shiftAt = (x: number, h: number) => (h === 0 ? paren(x) : `${paren(x)} ${signed(-h)}`);
/** Coefficient in front of a factor: 1 -> "", -1 -> "-", 2 -> "2". */
const co = (a: number) => (a === 1 ? "" : a === -1 ? "-" : String(a));

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

function pickDistinct(r: Rng, lo: number, hi: number, avoid: number): number {
  for (;;) {
    const n = r.int(lo, hi);
    if (n !== avoid) return n;
  }
}

/** A linear or quadratic polynomial as text usable for both LaTeX and typed answers, with a JS evaluator. */
interface Fn {
  tex: string;
  txt: string;
  f: (x: number) => number;
}
function linearFn(m: number, b: number): Fn {
  const t = poly([[m, "x"], [b, ""]]);
  return { tex: t, txt: t, f: (x) => m * x + b };
}
function quadraticFn(a: number, b: number, c: number): Fn {
  const t = poly([[a, "x^2"], [b, "x"], [c, ""]]);
  return { tex: t, txt: t, f: (x) => a * x * x + b * x + c };
}

// ── Lesson 1 generators ─────────────────────────────────────────────────────

const evaluateParent: Generator = (r) => {
  const kind = r.int(0, 5);
  if (kind === 0) {
    const h = r.int(-5, 5);
    const k = r.int(-6, 6);
    const x = pickDistinct(r, -7, 7, h);
    const inner = x - h;
    return {
      prompt: md`Evaluate $|${shift(h)}|${plusK(k)}$ when $x = ${x}$.`,
      answer: String(Math.abs(inner) + k),
      hint: "Work inside the bars first, then take the distance from 0, then add.",
      solution: [
        { math: md`|${shiftAt(x, h)}|${plusK(k)}`, note: "Substitute, in parentheses." },
        { math: md`|${inner}|${plusK(k)}`, note: "Inside the bars first." },
        { math: md`${Math.abs(inner)}${plusK(k)}${k ? ` = ${Math.abs(inner) + k}` : ""}`, note: md`$|${inner}| = ${Math.abs(inner)}$: the distance from 0 is never negative.` },
      ],
    };
  }
  if (kind === 1) {
    const s = r.int(0, 7);
    const h = r.int(-6, 6);
    const k = r.int(-5, 5);
    const x = s * s + h;
    return {
      prompt: md`Evaluate $\sqrt{${shift(h)}}${plusK(k)}$ when $x = ${x}$.`,
      answer: String(s + k),
      hint: md`Work out the radicand first. It's a perfect square.`,
      solution: [
        { math: md`\sqrt{${shiftAt(x, h)}}${plusK(k)}`, note: "Substitute." },
        { math: md`\sqrt{${s * s}}${plusK(k)}`, note: "Simplify under the root." },
        { math: md`${s}${plusK(k)}${k ? ` = ${s + k}` : ""}`, note: md`$\sqrt{${s * s}} = ${s}$, the non-negative root.` },
      ],
    };
  }
  if (kind === 2) {
    const s = r.pick([-4, -3, -2, -1, 1, 2, 3, 4]);
    const h = r.int(-5, 5);
    const x = s * s * s + h;
    return {
      prompt: md`Evaluate $\sqrt[3]{${shift(h)}}$ when $x = ${x}$.`,
      answer: String(s),
      verify: [`y^3 = ${shiftAt(x, h)}`],
      hint: md`The cube root of a negative number is negative: $\sqrt[3]{-8} = -2$ because $(-2)^3 = -8$.`,
      solution: [
        { math: h === 0 ? md`\sqrt[3]{${x}}` : md`\sqrt[3]{${shiftAt(x, h)}} = \sqrt[3]{${s * s * s}}`, note: h === 0 ? "Substitute." : "Substitute and simplify under the root." },
        { math: md`${s}`, note: md`Because $(${s})^3 = ${s * s * s}$. Unlike square roots, cube roots of negatives are real.` },
      ],
    };
  }
  if (kind === 3) {
    const h = r.int(-4, 4);
    const k = r.int(-4, 4);
    const x = pickDistinct(r, -6, 6, h);
    const d = x - h;
    return {
      prompt: md`Evaluate $\frac{1}{${shift(h)}}${plusK(k)}$ when $x = ${x}$. Give an exact fraction.`,
      answer: frac(1 + k * d, d),
      hint: "Find the denominator first, then add the constant with a common denominator.",
      solution: [
        { math: md`\frac{1}{${shiftAt(x, h)}}${plusK(k)} = ${fracTex(1, d)}${plusK(k)}`, note: md`Substitute and simplify the denominator.${d < 0 ? " A negative denominator makes the fraction negative." : ""}` },
        ...(k
          ? Math.abs(d) === 1
            ? [{ math: md`${1 / d} ${signed(k)} = ${1 / d + k}`, note: "" }]
            : [
                { math: md`${fracTex(1, d)} ${k < 0 ? "-" : "+"} \frac{${Math.abs(k) * Math.abs(d)}}{${Math.abs(d)}}`, note: md`Write ${k} over the common denominator ${Math.abs(d)}: $${k} = ${k < 0 ? "-" : ""}\frac{${Math.abs(k) * Math.abs(d)}}{${Math.abs(d)}}$.` },
                { math: fracTex(1 + k * d, d), note: "Add the numerators." },
              ]
          : []),
      ],
    };
  }
  if (kind === 4) {
    const n = r.int(2, 9);
    if (r.next() < 0.5) {
      return {
        prompt: md`Evaluate $\ln x$ when $x = e^{${n}}$.`,
        answer: String(n),
        hint: md`$\ln$ asks: what power of $e$ gives this? (Algebra 2, Unit 6.)`,
        solution: [{ math: md`\ln e^{${n}} = ${n}`, note: md`$\ln$ and $e^{x}$ undo each other.` }],
      };
    }
    return {
      prompt: md`Evaluate $e^{x}$ when $x = \ln ${n}$.`,
      answer: String(n),
      hint: md`$e^{\ln a} = a$: raising $e$ to "the power that gives $a$" gives $a$.`,
      solution: [{ math: md`e^{\ln ${n}} = ${n}`, note: md`$e^{x}$ and $\ln x$ are inverses.` }],
    };
  }
  const [tex, val, angleTex, answer] = r.pick<[string, string, string, string]>([
    ["\\sin x", "0", "0", "0"],
    ["\\sin x", "\\frac{\\pi}{2}", "\\tfrac{\\pi}{2}", "1"],
    ["\\sin x", "\\pi", "\\pi", "0"],
    ["\\sin x", "\\frac{3\\pi}{2}", "\\tfrac{3\\pi}{2}", "-1"],
    ["\\cos x", "0", "0", "1"],
    ["\\cos x", "\\frac{\\pi}{2}", "\\tfrac{\\pi}{2}", "0"],
    ["\\cos x", "\\pi", "\\pi", "-1"],
    ["\\cos x", "2\\pi", "2\\pi", "1"],
  ]);
  return {
    prompt: md`Evaluate $${tex}$ when $x = ${val}$.`,
    answer,
    hint: "Picture the unit circle: sine is the height, cosine the horizontal coordinate.",
    solution: [
      {
        math: md`${tex.replace(" x", "")}\left(${angleTex}\right) = ${answer}`,
        note: tex.startsWith("\\sin")
          ? md`At angle $${angleTex}$ the point on the unit circle has height (y-coordinate) $${answer}$, and sine is that height.`
          : md`At angle $${angleTex}$ the point on the unit circle has x-coordinate $${answer}$, and cosine is that coordinate.`,
      },
    ],
  };
};

const classifySymmetry: Generator = (r) => {
  const kind = r.int(0, 6);
  let tex: string;
  let parity: "even" | "odd" | "neither";
  let steps: Step[];
  if (kind === 0) {
    const [a, b, c] = [r.coef(-4, 4), r.nonzero(-6, 6), r.int(-5, 5)];
    tex = poly([[a, "x^4"], [b, "x^2"], [c, ""]]);
    parity = "even";
    steps = [
      { math: md`f(-x) = ${co(a)}(-x)^4 ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}(-x)^2${plusK(c)}`, note: "Replace every x by -x." },
      { math: md`= ${tex} = f(x)`, note: md`$(-x)^4 = x^4$ and $(-x)^2 = x^2$: even powers erase the sign.` },
      { math: md`\text{even}`, note: "Only even powers (a constant is the zero power), so the graph mirrors across the y-axis." },
    ];
  } else if (kind === 1) {
    const [a, b] = [r.coef(-4, 4), r.nonzero(-6, 6)];
    tex = poly([[a, "x^3"], [b, "x"]]);
    parity = "odd";
    steps = [
      { math: md`f(-x) = ${co(a)}(-x)^3 ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}(-x)`, note: "Replace every x by -x." },
      { math: md`= ${poly([[-a, "x^3"], [-b, "x"]])} = -f(x)`, note: md`$(-x)^3 = -x^3$: odd powers keep the sign.` },
      { math: md`\text{odd}`, note: "Every sign flips, so the graph turns onto itself under a half-turn about the origin." },
    ];
  } else if (kind === 2) {
    const [a, b] = [r.coef(-4, 4), r.nonzero(-6, 6)];
    tex = poly([[a, "x^2"], [b, "x"]]);
    parity = "neither";
    steps = [
      { math: md`f(-x) = ${co(a)}(-x)^2 ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}(-x) = ${poly([[a, "x^2"], [-b, "x"]])}`, note: "Replace every x by -x." },
      { math: md`\text{neither}`, note: md`Only the $x$ term changed sign. That's not $f(x)$ (the $x$ term differs) and not $-f(x)$ (the $x^2$ term didn't flip). A mix of even and odd powers is neither.` },
    ];
  } else if (kind === 3) {
    const [a, c] = [r.coef(-3, 3), r.nonzero(-6, 6)];
    tex = poly([[a, "x^3"], [c, ""]]);
    parity = "neither";
    steps = [
      { math: md`f(-x) = ${co(a)}(-x)^3${plusK(c)} = ${poly([[-a, "x^3"], [c, ""]])}`, note: "Replace every x by -x." },
      { math: md`\text{neither}`, note: md`The $x^3$ term flipped but the constant didn't, so this is neither $f(x)$ nor $-f(x)$. Check one number: $f(1) = ${a + c}$, $f(-1) = ${-a + c}$.` },
    ];
  } else if (kind === 4) {
    const c = r.nonzero(-6, 6);
    const m = r.pick([1, 1, 2, 3]);
    tex = `${co(m)}|x|${plusK(c)}`;
    parity = "even";
    steps = [
      { math: md`f(-x) = ${co(m)}|-x|${plusK(c)} = ${co(m)}|x|${plusK(c)} = f(x)`, note: md`$|-x| = |x|$: a number and its opposite are the same distance from 0.` },
      { math: md`\text{even}`, note: "" },
    ];
  } else if (kind === 5) {
    const m = r.pick([1, 2, -1, 3]);
    tex = `${co(m)}x|x|`;
    parity = "odd";
    steps = [
      { math: md`f(-x) = ${co(m)}(-x)|-x| = -${co(Math.abs(m)) || ""}${m < 0 ? "(-x|x|)" : "x|x|"} = -f(x)`, note: md`$|-x| = |x|$, and the lone factor $-x$ supplies one sign change.` },
      { math: md`\text{odd}`, note: "" },
    ];
  } else {
    const c = r.nonzero(-5, 5);
    tex = r.next() < 0.5 ? `|x| + x` : `\\frac{1}{${shift(c)}}`;
    parity = "neither";
    steps =
      tex === "|x| + x"
        ? [
            { math: md`f(-x) = |-x| + (-x) = |x| - x`, note: "Replace every x by -x." },
            { math: md`\text{neither}`, note: md`$|x| - x$ is not $|x| + x$, and it's not $-(|x| + x) = -|x| - x$ either. Check: $f(1) = 2$, $f(-1) = 0$.` },
          ]
        : [
            { math: md`f(-x) = \frac{1}{-x ${signed(-c)}}`, note: "Replace x by -x." },
            { math: md`\text{neither}`, note: md`$f(x) = \frac{1}{x}$ is odd, but shifting it sideways breaks the symmetry about the origin. Check: $f(${c + 1}) = 1$ and $f(${-c - 1}) = ${fracTex(1, -2 * c - 1)}$.` },
          ];
  }
  return {
    prompt: md`Is $f(x) = ${tex}$ even, odd or neither?`,
    choices: ["even", "odd", "neither"],
    accept: [parity],
    hint: md`Compute $f(-x)$ by replacing every $x$ with $-x$. If it simplifies to $f(x)$ the function is even; to $-f(x)$, odd.`,
    solution: steps,
  };
};

const rangeOfParent: Generator = (r) => {
  const kind = r.int(0, 6);
  const k = r.int(-6, 6);
  const h = r.int(-5, 5);
  const a = r.sign();
  const up: Iv = { lo: k, hi: null, loOpen: false };
  const down: Iv = { lo: null, hi: k, hiOpen: false };
  const halfLine = (parentTex: string, parentTxt: string, parentName: string) => {
    const tex = `${co(a)}${parentTex}${plusK(k)}`;
    return {
      prompt: md`Give the range of $f(x) = ${tex}$. ${FMT}`,
      answer: ivText(a > 0 ? up : down),
      form: "inequality" as const,
      hint: md`Start from the range of the parent $${parentTxt}$, which is $[0, \infty)$. ${a < 0 ? "The minus sign reflects it, then" : "Then"} the constant shifts it.`,
      solution: [
        { math: md`${parentTxt} \ge 0`, note: md`${parentName} is never negative, and it does reach 0.` },
        ...(a < 0 ? [{ math: md`-${parentTex} \le 0`, note: "Multiplying by -1 flips the inequality: the reflected graph lies on or below the x-axis." }] : []),
        ...(k ? [{ math: md`${tex} ${a > 0 ? "\\ge" : "\\le"} ${k}`, note: md`Adding ${k} to every output shifts the whole range by ${k}.` }] : []),
        { math: ivTex(a > 0 ? up : down), note: md`${k} is included: the parent reaches 0 exactly at its vertex.` },
      ],
    };
  };
  if (kind === 0) return halfLine(h === 0 ? "x^2" : `(${shift(h)})^2`, h === 0 ? "x^2" : `(${shift(h)})^2`, "A square");
  if (kind === 1) return halfLine(`|${shift(h)}|`, `|${shift(h)}|`, "An absolute value");
  if (kind === 2) return halfLine(`\\sqrt{${shift(h)}}`, `\\sqrt{${shift(h)}}`, "A square root");
  if (kind === 3) {
    const tex = `${co(a)}e^{x}${plusK(k)}`;
    const iv: Iv = a > 0 ? { lo: k, hi: null } : { lo: null, hi: k };
    return {
      prompt: md`Give the range of $f(x) = ${tex}$. ${FMT}`,
      answer: ivText(iv),
      form: "inequality",
      hint: md`$e^{x}$ is always positive but never 0 (Algebra 2, Unit 6). The endpoint is not included.`,
      solution: [
        { math: md`e^{x} > 0`, note: md`Every output of $e^{x}$ is positive, and it gets as close to 0 as you like without arriving.` },
        ...(a < 0 ? [{ math: md`-e^{x} < 0`, note: "The reflection puts every output below 0." }] : []),
        ...(k ? [{ math: md`${tex} ${a > 0 ? ">" : "<"} ${k}`, note: md`Shift by ${k}.` }] : []),
        { math: ivTex(iv), note: md`Open at ${k}: the horizontal asymptote $y = ${k}$ is approached, never reached.` },
      ],
    };
  }
  if (kind === 4) {
    const tex = `\\frac{1}{${shift(h)}}${plusK(k)}`;
    const ivs = allBut([k]);
    return {
      prompt: md`Give the range of $f(x) = ${tex}$. ${FMT}`,
      answer: unionText(ivs),
      form: "inequality",
      hint: md`$\frac{1}{x}$ takes every value except 0. Which single value does $f$ miss?`,
      solution: [
        { math: md`\frac{1}{${shift(h)}} \ne 0`, note: md`A fraction with numerator 1 is never 0, but it takes every other value: to get any output $v \ne 0$, solve $\frac{1}{${shift(h)}} = v$ for $x$.` },
        { math: md`${tex} \ne ${k}`, note: md`Shifting by ${k} moves the missing value from 0 to ${k}.` },
        { math: unionTex(ivs), note: md`Everything except ${k}: two open pieces joined by $\cup$.` },
      ],
    };
  }
  const [tex, name] = r.pick<[string, string]>([
    [`${co(a)}(${shift(h)})^3${plusK(k)}`, "A cube"],
    [`${co(a)}\\sqrt[3]{${shift(h)}}${plusK(k)}`, "A cube root"],
    [`${co(a)}\\ln(${shift(h)})${plusK(k)}`, "A logarithm"],
  ]);
  return {
    prompt: md`Give the range of $f(x) = ${tex}$. ${FMT}`,
    answer: "(-inf, inf)",
    accept: REALS,
    form: "inequality",
    hint: "Does the parent function have a lowest or highest output? Shifting and reflecting can't create one.",
    solution: [
      { math: tex, note: md`${name} takes every real value: large positive inputs give large outputs, and it goes just as far the other way.` },
      { math: md`(-\infty, \infty)`, note: "Reflecting and shifting a set that is already all of the reals leaves it all of the reals." },
    ],
  };
};

// ── Lesson 2 generators ─────────────────────────────────────────────────────

type Op = "+" | "-" | "*" | "/" | "fg" | "gf";
const OP_TEX: Record<Op, string> = { "+": "(f + g)", "-": "(f - g)", "*": "(fg)", "/": "\\left(\\frac{f}{g}\\right)", fg: "(f \\circ g)", gf: "(g \\circ f)" };

function randomFns(r: Rng): [Fn, Fn] {
  const f = r.next() < 0.6 ? quadraticFn(r.pick([1, 1, 2, -1]), r.int(-5, 5), r.nonzero(-6, 6)) : linearFn(r.coef(-5, 5), r.nonzero(-7, 7));
  const g = linearFn(r.coef(-4, 4), r.nonzero(-6, 6));
  return [f, g];
}

const combineValue: Generator = (r) => {
  const [f, g] = randomFns(r);
  const op = r.pick<Op>(["+", "-", "*", "/", "fg", "gf"]);
  let x = r.int(-4, 4);
  if (op === "/") while (g.f(x) === 0) x = r.int(-4, 4);
  const [fx, gx] = [f.f(x), g.f(x)];
  const fmt = "Give a number (a fraction like 3/4 is fine).";
  if (op === "fg" || op === "gf") {
    const [outer, inner, oName, iName] = op === "fg" ? [f, g, "f", "g"] : [g, f, "g", "f"];
    const innerValue = inner.f(x);
    const value = outer.f(innerValue);
    return {
      prompt: md`Let $f(x) = ${f.tex}$ and $g(x) = ${g.tex}$. Find $${OP_TEX[op]}(${x})$. ${fmt}`,
      answer: String(value),
      verify: [`y = ${at(outer.txt, at(inner.txt, x))}`],
      hint: md`$${OP_TEX[op]}(${x}) = ${oName}(${iName}(${x}))$: the inside function goes first.`,
      solution: [
        { math: md`${iName}(${x}) = ${at(inner.tex, x)} = ${innerValue}`, note: md`Evaluate the inner function, $${iName}$, first.` },
        { math: md`${oName}(${innerValue}) = ${at(outer.tex, innerValue)} = ${value}`, note: md`Feed that output into $${oName}$.` },
      ],
    };
  }
  const value = op === "+" ? fx + gx : op === "-" ? fx - gx : op === "*" ? fx * gx : NaN;
  const answer = op === "/" ? frac(fx, gx) : String(value);
  const opWord = { "+": "add", "-": "subtract", "*": "multiply", "/": "divide" }[op];
  const resultTex = op === "/" ? fracTex(fx, gx) : String(value);
  return {
    prompt: md`Let $f(x) = ${f.tex}$ and $g(x) = ${g.tex}$. Find $${OP_TEX[op]}(${x})$. ${fmt}`,
    answer,
    verify: [`y = (${at(f.txt, x)}) ${op} (${at(g.txt, x)})`],
    hint: md`$${OP_TEX[op]}(${x})$ means: find $f(${x})$ and $g(${x})$ separately, then ${opWord} the two numbers.`,
    solution: [
      { math: md`f(${x}) = ${at(f.tex, x)} = ${fx}`, note: "Evaluate f." },
      { math: md`g(${x}) = ${at(g.tex, x)} = ${gx}`, note: "Evaluate g." },
      { math: md`${paren(fx)} ${op === "*" ? "\\cdot" : op === "/" ? "\\div" : op} ${paren(gx)} = ${resultTex}`, note: md`Combine the two outputs. ${op === "/" ? "The quotient is defined because $g(" + x + ") \\ne 0$." : ""}` },
    ],
  };
};

const combineFormula: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const [a, b, c] = [r.coef(-3, 3), r.int(-6, 6), r.nonzero(-7, 7)];
    const [m, n] = [r.nonzero(-6, 6), r.nonzero(-7, 7)];
    const f = quadraticFn(a, b, c);
    const g = linearFn(m, n);
    const minus = r.next() < 0.5;
    const answer = poly([[a, "x^2"], [minus ? b - m : b + m, "x"], [minus ? c - n : c + n, ""]]);
    return {
      prompt: md`Let $f(x) = ${f.tex}$ and $g(x) = ${g.tex}$. Find a simplified formula for $${minus ? "(f - g)" : "(f + g)"}(x)$.`,
      answer,
      simplified: true,
      verify: [`q = (${f.txt}) ${minus ? "-" : "+"} (${g.txt})`],
      hint: minus ? "Subtract the whole of g(x): put it in parentheses and flip every sign inside." : "Add the two formulas and combine like terms.",
      solution: [
        { math: md`(${f.tex}) ${minus ? "-" : "+"} (${g.tex})`, note: md`$${minus ? "(f - g)" : "(f + g)"}(x) = f(x) ${minus ? "-" : "+"} g(x)$ by definition.` },
        ...(minus ? [{ math: poly([[a, "x^2"], [b, "x"], [c, ""], [-m, "x"], [-n, ""]]), note: "Distribute the minus sign." }] : []),
        { math: answer, note: "Combine like terms." },
      ],
    };
  }
  if (kind === 1) {
    const [a, b] = [r.coef(-4, 4), r.nonzero(-6, 6)];
    const [m, n] = [r.nonzero(-4, 4), r.nonzero(-6, 6)];
    const f = linearFn(a, b);
    const g = linearFn(m, n);
    const answer = poly([[a * m, "x^2"], [a * n + b * m, "x"], [b * n, ""]]);
    return {
      prompt: md`Let $f(x) = ${f.tex}$ and $g(x) = ${g.tex}$. Find a simplified, expanded formula for $(fg)(x)$.`,
      answer,
      simplified: true,
      expanded: true,
      verify: [`q = (${f.txt})(${g.txt})`],
      hint: "Multiply the two formulas (each term of the first by each term of the second), then combine like terms.",
      solution: [
        { math: md`(${f.tex})(${g.tex})`, note: md`$(fg)(x) = f(x) \cdot g(x)$.` },
        { math: poly([[a * m, "x^2"], [a * n, "x"], [b * m, "x"], [b * n, ""]]), note: "Distribute each term: both terms of the first factor times both terms of the second." },
        { math: answer, note: "Combine the x terms." },
      ],
    };
  }
  if (kind === 2) {
    const [a, b, c] = [r.pick([1, 1, 2, -1]), r.int(-4, 4), r.int(-5, 5)];
    const [m, n] = [r.nonzero(-3, 3), r.nonzero(-5, 5)];
    const f = quadraticFn(a, b, c);
    const g = linearFn(m, n);
    // f(g(x)) = a(mx + n)^2 + b(mx + n) + c
    const answer = poly([[a * m * m, "x^2"], [2 * a * m * n + b * m, "x"], [a * n * n + b * n + c, ""]]);
    return {
      prompt: md`Let $f(x) = ${f.tex}$ and $g(x) = ${g.tex}$. Find a simplified, expanded formula for $(f \circ g)(x)$.`,
      answer,
      simplified: true,
      expanded: true,
      verify: [`q = ${at(f.txt, g.txt)}`],
      hint: md`$(f \circ g)(x) = f(g(x))$: wherever $f$'s formula has an $x$, put the whole of $g(x) = ${g.tex}$ in parentheses.`,
      solution: [
        { math: md`f(${g.tex}) = ${at(f.tex, g.tex)}`, note: md`Replace every $x$ in $f$ by $(${g.tex})$.` },
        { math: md`${co(a)}(${poly([[m * m, "x^2"], [2 * m * n, "x"], [n * n, ""]])})${b ? ` ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}(${g.tex})` : ""}${plusK(c)}`, note: "Square the binomial." },
        { math: answer, note: "Distribute and combine like terms." },
      ],
    };
  }
  const [a, b, c] = [r.pick([1, 1, 2, -1, 3]), r.int(-5, 5), r.int(-5, 5)];
  const [m, n] = [r.coef(-3, 3), r.nonzero(-6, 6)];
  const f = quadraticFn(a, b, c);
  const g = linearFn(m, n);
  // g(f(x)) = m f(x) + n
  const answer = poly([[m * a, "x^2"], [m * b, "x"], [m * c + n, ""]]);
  return {
    prompt: md`Let $f(x) = ${f.tex}$ and $g(x) = ${g.tex}$. Find a simplified, expanded formula for $(g \circ f)(x)$.`,
    answer,
    simplified: true,
    expanded: true,
    verify: [`q = ${at(g.txt, f.txt)}`],
    hint: md`$(g \circ f)(x) = g(f(x))$: put the whole of $f(x)$ into $g$'s formula, in parentheses.`,
    solution: [
      { math: md`g(f(x)) = ${m}(${f.tex})${plusK(n)}`, note: md`Replace the $x$ in $g(x) = ${g.tex}$ by $(${f.tex})$.` },
      { math: answer, note: md`Distribute the ${m} and combine the constants.` },
    ],
  };
};

const combinedDomain: Generator = (r) => {
  const kind = r.int(0, 5);
  if (kind === 0 || kind === 1) {
    const a = r.int(-4, 4);
    const b = pickDistinct(r, -5, 5, a);
    const ftex = `\\sqrt{${shift(a)}}`;
    const gtex = kind === 0 ? `\\frac{1}{${shift(b)}}` : shift(b);
    const what = kind === 0 ? "(f + g)(x)" : "\\left(\\frac{f}{g}\\right)(x)";
    const ivs: Iv[] = b > a ? [{ lo: a, hi: b, loOpen: false }, { lo: b, hi: null }] : [{ lo: a, hi: null, loOpen: false }];
    return {
      prompt: md`Let $f(x) = ${ftex}$ and $g(x) = ${gtex}$. Find the domain of $${what}$. ${FMT}`,
      answer: unionText(ivs),
      form: "inequality",
      hint: kind === 0 ? "Both f and g must be defined. Write down each one's domain and keep what they share." : "f must be defined, g must be defined, and the denominator g(x) can't be 0.",
      solution: [
        { math: md`${shift(a)} \ge 0 \;\Rightarrow\; x \ge ${a}`, note: md`$f$ needs its radicand to be 0 or more.` },
        { math: md`x \ne ${b}`, note: kind === 0 ? md`$g$ has a denominator, which can't be 0.` : md`$g(x)$ is the denominator of the quotient, so it can't be 0.` },
        { math: unionTex(ivs), note: b > a ? md`Start at ${a} (included) and cut out the point ${b}.` : md`${b} is already outside $x \ge ${a}$, so nothing more is removed.` },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(-4, 3);
    const b = a + r.int(1, 6);
    const op = r.pick(["+", "*", "/"] as const);
    const what = op === "+" ? "(f + g)(x)" : op === "*" ? "(fg)(x)" : "\\left(\\frac{f}{g}\\right)(x)";
    const iv: Iv = { lo: a, hi: b, loOpen: false, hiOpen: op === "/" };
    return {
      prompt: md`Let $f(x) = \sqrt{${shift(a)}}$ and $g(x) = \sqrt{${poly([[b, ""], [-1, "x"]])}}$. Find the domain of $${what}$. ${FMT}`,
      answer: ivText(iv),
      form: "inequality",
      hint: "Each root needs a non-negative radicand. Both conditions must hold at once." + (op === "/" ? " And a denominator can't be 0." : ""),
      solution: [
        { math: md`${shift(a)} \ge 0 \;\Rightarrow\; x \ge ${a}`, note: md`Domain of $f$.` },
        { math: md`${poly([[b, ""], [-1, "x"]])} \ge 0 \;\Rightarrow\; x \le ${b}`, note: md`Domain of $g$. Subtracting $x$ reverses the direction: $${b} \ge x$.` },
        ...(op === "/" ? [{ math: md`\sqrt{${poly([[b, ""], [-1, "x"]])}} \ne 0 \;\Rightarrow\; x \ne ${b}`, note: "The denominator can't be 0." }] : []),
        { math: ivTex(iv), note: md`The overlap of $x \ge ${a}$ and $x \le ${b}$${op === "/" ? `, with ${b} removed` : ""}.` },
      ],
    };
  }
  if (kind === 3) {
    const a = r.nonzero(-6, 6);
    const forward = r.next() < 0.5;
    const iv: Iv = forward ? { lo: a, hi: null, loOpen: false } : { lo: null, hi: a, hiOpen: false };
    const gtex = forward ? shift(a) : poly([[a, ""], [-1, "x"]]);
    return {
      prompt: md`Let $f(x) = \sqrt{x}$ and $g(x) = ${gtex}$. Find the domain of $(f \circ g)(x)$. ${FMT}`,
      answer: ivText(iv),
      form: "inequality",
      hint: md`$(f \circ g)(x) = f(g(x)) = \sqrt{g(x)}$. The output of $g$ must be an allowed input of $f$.`,
      solution: [
        { math: md`(f \circ g)(x) = \sqrt{${gtex}}`, note: md`$g$ is defined everywhere, so the only condition is that $g(x)$ is in the domain of $f$.` },
        { math: md`${gtex} \ge 0 \;\Rightarrow\; x ${forward ? "\\ge" : "\\le"} ${a}`, note: forward ? "Solve for x." : md`Solve for $x$: subtracting $x$ from both sides reverses the inequality.` },
        { math: ivTex(iv), note: "" },
      ],
    };
  }
  if (kind === 4) {
    const a = r.nonzero(-6, 6);
    const ivs = allBut([a]);
    return {
      prompt: md`Let $f(x) = \frac{1}{x}$ and $g(x) = ${shift(a)}$. Find the domain of $(f \circ g)(x)$. ${FMT}`,
      answer: unionText(ivs),
      form: "inequality",
      hint: md`$f(g(x)) = \frac{1}{g(x)}$. Which input makes $g(x) = 0$?`,
      solution: [
        { math: md`(f \circ g)(x) = \frac{1}{${shift(a)}}`, note: md`$g$ is defined everywhere; $f$ needs a non-zero input.` },
        { math: md`${shift(a)} \ne 0 \;\Rightarrow\; x \ne ${a}`, note: "" },
        { math: unionTex(ivs), note: "Every real number except one." },
      ],
    };
  }
  const m = r.int(1, 6);
  const c = r.nonzero(-7, 7);
  const ivs = allBut([-m, m]);
  return {
    prompt: md`Let $f(x) = ${shift(-c)}$ and $g(x) = x^2 - ${m * m}$. Find the domain of $\left(\frac{f}{g}\right)(x)$. ${FMT}`,
    answer: unionText(ivs),
    form: "inequality",
    hint: "Both functions are polynomials, defined everywhere. The only danger is the denominator.",
    solution: [
      { math: md`x^2 - ${m * m} = 0 \;\Rightarrow\; (x - ${m})(x + ${m}) = 0`, note: "Set the denominator equal to 0 and factor." },
      { math: md`x = ${m} \text{ or } x = -${m}`, note: "Zero product property. Both must be removed." },
      { math: unionTex(ivs), note: "Three open pieces." },
    ],
  };
};

// ── Lesson 3 generators ─────────────────────────────────────────────────────

/** A random piecewise function with 2 or 3 pieces and integer breakpoints; the pieces are chosen so no two meet at a seam. */
function randomPiecewise(r: Rng): { pieces: Fn[]; cuts: number[]; tex: string } {
  const n = r.int(2, 3);
  const c1 = r.int(-3, 2);
  const cuts = n === 2 ? [c1] : [c1, c1 + r.int(2, 4)];
  const make = (): Fn => {
    const k = r.int(0, 2);
    if (k === 0) return linearFn(r.nonzero(-3, 3), r.int(-5, 5));
    if (k === 1) return quadraticFn(r.pick([1, 1, -1]), r.int(-2, 2), r.int(-4, 4));
    const c = r.int(-5, 5);
    return { tex: String(c), txt: String(c), f: () => c };
  };
  const pieces: Fn[] = [];
  for (let i = 0; i < n; i++) {
    let p = make();
    // Keep a visible jump at each seam so the choice of piece matters.
    for (let tries = 0; i > 0 && p.f(cuts[i - 1]!) === pieces[i - 1]!.f(cuts[i - 1]!) && tries < 20; tries++) p = make();
    pieces.push(p);
  }
  const conds =
    n === 2
      ? [`x < ${cuts[0]}`, `x \\ge ${cuts[0]}`]
      : [`x < ${cuts[0]}`, `${cuts[0]} \\le x < ${cuts[1]}`, `x \\ge ${cuts[1]}`];
  const tex = `\\begin{cases} ${pieces.map((p, i) => `${p.tex} & \\text{if } ${conds[i]}`).join(" \\\\ ")} \\end{cases}`;
  return { pieces, cuts, tex };
}

const piecewiseValue: Generator = (r) => {
  const { pieces, cuts, tex } = randomPiecewise(r);
  const x = r.next() < 0.4 ? r.pick(cuts) : r.int(cuts[0]! - 4, cuts[cuts.length - 1]! + 4);
  const i = cuts.filter((c) => x >= c).length;
  const piece = pieces[i]!;
  const value = piece.f(x);
  const atCut = cuts.includes(x);
  return {
    prompt: md`$$f(x) = ${tex}$$ Find $f(${x})$.`,
    answer: String(value),
    verify: [`y = ${at(piece.txt, x)}`],
    hint: atCut
      ? md`$x = ${x}$ sits exactly on a boundary. Read the conditions carefully: only one of them includes ${x} itself.`
      : md`First decide which condition $x = ${x}$ satisfies. Then use that piece's formula and ignore the others.`,
    solution: [
      { math: md`x = ${x} \;\Rightarrow\; \text{use } ${piece.tex}`, note: atCut ? md`${x} satisfies the condition with $\le$ or $\ge$, not the strict one.` : md`${x} satisfies this piece's condition and no other.` },
      piece.tex.includes("x")
        ? { math: md`f(${x}) = ${at(piece.tex, x)} = ${value}`, note: "Substitute into that one formula." }
        : { math: md`f(${x}) = ${value}`, note: "A constant piece gives the same output for every input in its stretch." },
    ],
  };
};

const stepFunction: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0 || kind === 1) {
    const whole = r.int(-5, 6);
    const tenths = r.int(1, 9);
    const v = whole + (whole < 0 ? -tenths : tenths) / 10;
    const vTex = v.toFixed(1);
    const floor = Math.floor(v);
    const ceil = Math.ceil(v);
    if (kind === 0) {
      return {
        prompt: md`Find $\lfloor ${vTex} \rfloor$, the greatest integer that is less than or equal to $${vTex}$.`,
        answer: String(floor),
        hint: v < 0 ? "On a number line, which integer is just to the left of the value? For negatives, rounding down moves away from 0." : "Which integer is just to the left of the value on a number line?",
        solution: [
          { math: md`${floor} \le ${vTex} < ${floor + 1}`, note: "Trap the value between consecutive integers." },
          { math: md`\lfloor ${vTex} \rfloor = ${floor}`, note: v < 0 ? md`The floor is the integer on the left, $${floor}$, not $${floor + 1}$: "down" means toward $-\infty$.` : "The floor is the integer on the left." },
        ],
      };
    }
    return {
      prompt: md`Find $\lceil ${vTex} \rceil$, the least integer that is greater than or equal to $${vTex}$.`,
      answer: String(ceil),
      hint: "Which integer is just to the right of the value on a number line?",
      solution: [
        { math: md`${ceil - 1} < ${vTex} \le ${ceil}`, note: "Trap the value between consecutive integers." },
        { math: md`\lceil ${vTex} \rceil = ${ceil}`, note: v < 0 ? md`The ceiling is the integer on the right, $${ceil}$: "up" means toward $+\infty$, so for a negative it moves toward 0.` : "The ceiling is the integer on the right." },
      ],
    };
  }
  if (kind === 2) {
    const rate = r.pick([2, 3, 4, 5, 6]);
    const hours = r.int(1, 5);
    const minutes = r.pick([5, 10, 15, 20, 30, 40, 45, 50]);
    const billed = hours + 1;
    const shipping = r.next() < 0.5;
    if (shipping) {
      const lb = r.int(1, 9);
      const oz = r.pick([2, 4, 6, 8, 10, 12, 14]);
      return {
        prompt: md`A courier charges ${rate} dollars per pound **or any part of a pound**. What does it cost, in dollars, to ship a parcel weighing ${lb} pounds and ${oz} ounces?`,
        answer: String(rate * (lb + 1)),
        hint: md`The weight is between ${lb} and ${lb + 1} pounds. Any part of a pound is charged as a whole pound, so round the weight up before multiplying.`,
        solution: [
          { math: md`${lb} < ${lb}\tfrac{${oz}}{16} < ${lb + 1}`, note: md`${oz} ounces is part of a pound, so the parcel is billed as ${lb + 1} pounds.` },
          { math: md`\text{cost} = ${rate} \cdot \lceil ${lb}\tfrac{${oz}}{16} \rceil = ${rate} \cdot ${lb + 1} = ${rate * (lb + 1)}`, note: "The cost is a step function of the weight." },
        ],
      };
    }
    return {
      prompt: md`A garage charges ${rate} dollars for each hour **or any part of an hour**. What does a stay of ${hours} hours and ${minutes} minutes cost, in dollars?`,
      answer: String(rate * billed),
      hint: md`${minutes} minutes is part of an hour, and any part counts as a full hour. How many hours are billed?`,
      solution: [
        { math: md`${hours} < ${hours}\tfrac{${minutes}}{60} < ${billed}`, note: md`The stay is more than ${hours} hours, so it's billed as ${billed}.` },
        { math: md`\text{cost} = ${rate} \cdot \lceil ${hours}\tfrac{${minutes}}{60} \rceil = ${rate} \cdot ${billed} = ${rate * billed}`, note: "The cost jumps at each whole hour and is flat in between." },
      ],
    };
  }
  const c = r.coef(-4, 4);
  const k = r.int(-5, 5);
  const whole = r.int(-4, 5);
  const tenths = r.int(1, 9);
  const v = whole + (whole < 0 ? -tenths : tenths) / 10;
  const vTex = v.toFixed(1);
  const fl = Math.floor(v);
  return {
    prompt: md`Let $f(x) = ${c}\lfloor x \rfloor${plusK(k)}$. Find $f(${vTex})$.`,
    answer: String(c * fl + k),
    hint: "Take the floor first (the greatest integer at most x), then multiply and add as usual.",
    solution: [
      { math: md`\lfloor ${vTex} \rfloor = ${fl}`, note: md`$${fl} \le ${vTex} < ${fl + 1}$.` },
      { math: md`${c}(${fl})${plusK(k)} = ${c * fl + k}`, note: "" },
    ],
  };
};

const joinPieces: Generator = (r) => {
  const c = r.nonzero(-4, 4);
  const unknownLeft = r.next() < 0.6;
  if (unknownLeft) {
    const m = r.coef(-4, 4);
    const right = r.next() < 0.5 ? quadraticFn(r.pick([1, 1, -1]), r.int(-3, 3), r.int(-5, 5)) : linearFn(r.nonzero(-5, 5), r.int(-6, 6));
    const rc = right.f(c);
    const k = rc - m * c;
    const leftTex = `${m}x + k`;
    return {
      prompt: md`$$f(x) = \begin{cases} ${leftTex} & \text{if } x < ${c} \\ ${right.tex} & \text{if } x \ge ${c} \end{cases}$$ Find the value of $k$ that makes the two pieces meet at $x = ${c}$, so the graph has no jump there.`,
      answer: String(k),
      verify: [`${m}(${c}) + k = ${at(right.txt, c)}`],
      hint: md`The pieces meet when both formulas give the same value at $x = ${c}$. Set them equal there and solve for $k$.`,
      solution: [
        { math: md`${right.tex.replace(/x/g, `(${c})`)} = ${rc}`, note: md`The right piece's value at $x = ${c}$. The left piece doesn't include ${c}, but its formula approaches this seam.` },
        { math: md`${m}(${c}) + k = ${rc}`, note: "For no jump, the left formula must give the same value there." },
        { math: md`k = ${rc} ${signed(-m * c)} = ${k}`, note: "" },
      ],
    };
  }
  const left = r.next() < 0.5 ? quadraticFn(r.pick([1, 1, -1]), r.int(-3, 3), r.int(-5, 5)) : linearFn(r.nonzero(-5, 5), r.int(-6, 6));
  const n = r.int(-6, 6);
  const lc = left.f(c);
  const answer = frac(lc - n, c);
  return {
    prompt: md`$$f(x) = \begin{cases} ${left.tex} & \text{if } x < ${c} \\ kx${plusK(n)} & \text{if } x \ge ${c} \end{cases}$$ Find the value of $k$ that makes the two pieces meet at $x = ${c}$, so the graph has no jump there. A fraction is fine.`,
    answer,
    verify: [`k(${c}) ${signed(n)} = ${at(left.txt, c)}`],
    hint: md`Evaluate the left formula at $x = ${c}$, then choose $k$ so the right formula matches it there.`,
    solution: [
      { math: md`${left.tex.replace(/x/g, `(${c})`)} = ${lc}`, note: md`The left piece's value as $x$ reaches ${c}.` },
      { math: md`k(${c})${plusK(n)} = ${lc}`, note: "The right piece must give the same value at the seam." },
      { math: md`k = ${fracTex(lc - n, c)}`, note: md`Subtract ${n} and divide by ${c}.` },
    ],
  };
};

// ── Lesson 4 generators ─────────────────────────────────────────────────────

const averageRate: Generator = (r) => {
  const kind = r.int(0, 3);
  let fn: Fn;
  let a: number;
  let b: number;
  let fa: string;
  let fb: string;
  let num: number;
  let den: number;
  /** The formula with a number substituted, for display. */
  let texAt: (v: number) => string;
  if (kind === 0) {
    fn = quadraticFn(r.pick([1, 1, 2, -1]), r.int(-4, 4), r.int(-5, 5));
    a = r.int(-4, 3);
    b = a + r.int(1, 5);
    [num, den] = [fn.f(b) - fn.f(a), b - a];
    [fa, fb] = [String(fn.f(a)), String(fn.f(b))];
    texAt = (v) => at(fn.tex, v);
  } else if (kind === 1) {
    const c = r.int(-4, 4);
    fn = { tex: `x^3${plusK(c)}`, txt: `x^3${plusK(c)}`, f: (x) => x * x * x + c };
    a = r.int(-3, 2);
    b = a + r.int(1, 3);
    [num, den] = [fn.f(b) - fn.f(a), b - a];
    [fa, fb] = [String(fn.f(a)), String(fn.f(b))];
    texAt = (v) => at(fn.tex, v);
  } else if (kind === 2) {
    const [p, q] = [r.int(0, 3), r.int(4, 7)];
    fn = { tex: "\\sqrt{x}", txt: "sqrt(x)", f: (x) => Math.sqrt(x) };
    [a, b] = [p * p, q * q];
    [num, den] = [q - p, b - a];
    [fa, fb] = [String(p), String(q)];
    texAt = (v) => `\\sqrt{${v}}`;
  } else {
    fn = { tex: "\\frac{1}{x}", txt: "1/x", f: (x) => 1 / x };
    a = r.int(1, 5);
    b = a + r.int(1, 5);
    // (1/b - 1/a)/(b - a) = -1/(ab)
    [num, den] = [-1, a * b];
    [fa, fb] = [fracTex(1, a), fracTex(1, b)];
    texAt = (v) => `\\frac{1}{${v}}`;
  }
  const answer = frac(num, den);
  return {
    prompt: md`Find the average rate of change of $f(x) = ${fn.tex}$ on the interval $[${a}, ${b}]$. Give an exact number (a fraction like -3/4 is fine).`,
    answer,
    verify: [`y (${b} - (${a})) = (${at(fn.txt, b)}) - (${at(fn.txt, a)})`],
    hint: md`Average rate of change $= \dfrac{f(${b}) - f(${a})}{${b} - ${paren(a)}}$: the slope of the line through the two endpoints of the graph.`,
    solution: [
      { math: md`f(${b}) = ${texAt(b) === fb ? fb : `${texAt(b)} = ${fb}`}`, note: "Output at the right end." },
      { math: md`f(${a}) = ${texAt(a) === fa ? fa : `${texAt(a)} = ${fa}`}`, note: "Output at the left end." },
      {
        math: kind === 3 ? md`\frac{${fb} - ${fa}}{${b - a}} = \frac{${fracTex(a - b, a * b)}}{${b - a}} = ${fracTex(num, den)}` : md`\frac{${fb} - ${paren(Number(fa))}}{${b} - ${paren(a)}} = \frac{${num}}{${den}}${frac(num, den) !== `${num}/${den}` ? ` = ${fracTex(num, den)}` : ""}`,
        note: "Change in output over change in input.",
      },
    ],
  };
};

/** The difference quotient prompt, shared by the two generators. */
const DQ = (tex: string, extra = "") => md`Let $f(x) = ${tex}$. Simplify the difference quotient $\dfrac{f(x + h) - f(x)}{h}$, where $h \ne 0$. Your answer may use $x$ and $h$.${extra}`;

const differenceQuotientPoly: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [m, c] = [r.coef(-7, 7), r.nonzero(-9, 9)];
    const fn = linearFn(m, c);
    return {
      prompt: DQ(fn.tex),
      answer: String(m),
      simplified: true,
      // The answer is a constant, so x and h can't be left free: check the quotient at two concrete intervals.
      verify: [`(${at(fn.txt, "2 + 0.5")} - (${at(fn.txt, 2)}))/0.5 = q`, `(${at(fn.txt, "-1 + 3")} - (${at(fn.txt, -1)}))/3 = q`],
      hint: md`Write out $f(x + h)$ by replacing $x$ with $(x + h)$. Everything without an $h$ cancels.`,
      solution: [
        { math: md`f(x + h) = ${m}(x + h)${plusK(c)} = ${poly([[m, "x"], [m, "h"], [c, ""]])}`, note: "Substitute x + h for x and distribute." },
        { math: md`\frac{(${poly([[m, "x"], [m, "h"], [c, ""]])}) - (${fn.tex})}{h} = \frac{${poly([[m, "h"]])}}{h}`, note: md`The $${poly([[m, "x"]])}$ and the constant cancel.` },
        { math: md`${m}`, note: md`Divide by $h$. A line changes at the same rate everywhere: its slope.` },
      ],
    };
  }
  if (kind === 1) {
    const [a, b, c] = [r.pick([1, 1, 2, -1, 3]), r.int(-5, 5), r.int(-6, 6)];
    const fn = quadraticFn(a, b, c);
    const answer = poly([[2 * a, "x"], [a, "h"], [b, ""]]);
    const expanded = poly([[a, "x^2"], [2 * a, "xh"], [a, "h^2"], [b, "x"], [b, "h"], [c, ""]]);
    return {
      prompt: DQ(fn.tex),
      answer,
      simplified: true,
      verify: [`(${at(fn.txt, "x + h")} - (${fn.txt}))/h = q`],
      hint: md`Expand $(x + h)^2 = x^2 + 2xh + h^2$ first. After subtracting $f(x)$, every surviving term has a factor of $h$.`,
      solution: [
        { math: md`f(x + h) = ${co(a)}(x + h)^2${b ? ` ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}(x + h)` : ""}${plusK(c)}`, note: "Replace every x by (x + h)." },
        { math: md`= ${expanded}`, note: md`$(x + h)^2 = x^2 + 2xh + h^2$, then distribute.` },
        { math: md`f(x + h) - f(x) = ${poly([[2 * a, "xh"], [a, "h^2"], [b, "h"]])}`, note: md`Subtract $${fn.tex}$: the terms without $h$ cancel exactly.` },
        { math: md`\frac{h(${answer})}{h} = ${answer}`, note: md`Factor out $h$ and cancel it, which is allowed because $h \ne 0$.` },
      ],
    };
  }
  const b = r.int(-5, 5);
  const c = r.int(-4, 4);
  const fn: Fn = { tex: poly([[1, "x^3"], [b, "x"], [c, ""]]), txt: poly([[1, "x^3"], [b, "x"], [c, ""]]), f: (x) => x ** 3 + b * x + c };
  const answer = poly([[3, "x^2"], [3, "xh"], [1, "h^2"], [b, ""]]);
  return {
    prompt: DQ(fn.tex),
    answer,
    simplified: true,
    verify: [`(${at(fn.txt, "x + h")} - (${fn.txt}))/h = q`],
    hint: md`$(x + h)^3 = x^3 + 3x^2h + 3xh^2 + h^3$ (Algebra 2, binomial expansion). Then subtract and factor out $h$.`,
    solution: [
      { math: md`f(x + h) = (x + h)^3${b ? ` ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}(x + h)` : ""}${plusK(c)}`, note: "Replace every x by (x + h)." },
      { math: md`= ${poly([[1, "x^3"], [3, "x^2h"], [3, "xh^2"], [1, "h^3"], [b, "x"], [b, "h"], [c, ""]])}`, note: "Expand the cube and distribute." },
      { math: md`f(x + h) - f(x) = ${poly([[3, "x^2h"], [3, "xh^2"], [1, "h^3"], [b, "h"]])}`, note: md`The $x^3$, the $${poly([[b, "x"]]) || "0"}$ and the constant cancel.` },
      { math: md`\frac{h(${answer})}{h} = ${answer}`, note: md`Every surviving term has an $h$; factor it out and cancel.` },
    ],
  };
};

const differenceQuotientRational: Generator = (r) => {
  const kind = r.int(0, 2);
  const factoredNote = " Leave the denominator as a product of factors.";
  if (kind === 0) {
    const k = r.int(1, 6);
    const kTex = k === 1 ? "" : String(k);
    return {
      prompt: DQ(`\\frac{${k}}{x}`),
      answer: `-${k}/(x^2 + xh)`,
      simplified: true,
      verify: [`(${k}/(x + h) - ${k}/x)/h = q`],
      hint: md`Combine $\frac{${k}}{x + h} - \frac{${k}}{x}$ over the common denominator $x(x + h)$ before dividing by $h$.`,
      solution: [
        { math: md`f(x + h) - f(x) = \frac{${k}}{x + h} - \frac{${k}}{x} = \frac{${kTex}x - ${kTex}(x + h)}{x(x + h)}`, note: "Common denominator." },
        { math: md`= \frac{-${kTex}h}{x(x + h)}`, note: md`$${kTex}x - ${kTex}x - ${kTex}h = -${kTex}h$.` },
        { math: md`\frac{1}{h} \cdot \frac{-${kTex}h}{x(x + h)} = -\frac{${k}}{x(x + h)}`, note: md`Dividing by $h$ is multiplying by $\frac1h$. Cancel the $h$, since $h \ne 0$.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.int(1, 5);
    const c = r.nonzero(-5, 5);
    const kTex = k === 1 ? "" : String(k);
    const d = shift(-c);
    const dh = poly([[1, "x"], [1, "h"], [c, ""]]);
    return {
      prompt: DQ(`\\frac{${k}}{${d}}`, factoredNote),
      answer: `-${k}/((${d})(${dh}))`,
      simplified: true,
      verify: [`(${k}/(${dh}) - ${k}/(${d}))/h = q`],
      hint: md`Replacing $x$ by $x + h$ turns the denominator into $${dh}$. Combine the two fractions over $(${d})(${dh})$.`,
      solution: [
        { math: md`f(x + h) - f(x) = \frac{${k}}{${dh}} - \frac{${k}}{${d}}`, note: md`$f(x + h)$ has $x + h$ wherever $f(x)$ had $x$.` },
        { math: md`= \frac{${kTex}(${d}) - ${kTex}(${dh})}{(${d})(${dh})} = \frac{-${kTex}h}{(${d})(${dh})}`, note: md`Common denominator. In the numerator everything cancels except $-${kTex}h$.` },
        { math: md`\frac{1}{h} \cdot \frac{-${kTex}h}{(${d})(${dh})} = -\frac{${k}}{(${d})(${dh})}`, note: md`Cancel $h$ ($h \ne 0$).` },
      ],
    };
  }
  return {
    prompt: DQ("\\frac{1}{x^2}", factoredNote),
    answer: "-(2x + h)/(x^2 (x + h)^2)",
    simplified: true,
    verify: ["(1/(x + h)^2 - 1/x^2)/h = q"],
    hint: md`Common denominator $x^2(x + h)^2$. The numerator becomes $x^2 - (x + h)^2$, a difference of squares in disguise.`,
    solution: [
      { math: md`f(x + h) - f(x) = \frac{1}{(x + h)^2} - \frac{1}{x^2} = \frac{x^2 - (x + h)^2}{x^2 (x + h)^2}`, note: "Common denominator." },
      { math: md`x^2 - (x + h)^2 = x^2 - x^2 - 2xh - h^2 = -h(2x + h)`, note: "Expand the square and factor out -h." },
      { math: md`\frac{1}{h} \cdot \frac{-h(2x + h)}{x^2 (x + h)^2} = -\frac{2x + h}{x^2 (x + h)^2}`, note: md`Cancel $h$ ($h \ne 0$).` },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit1: Unit = {
  title: "The Function Toolkit",
  lessons: [
    {
      id: slug("Parent functions"),
      title: "Parent functions",
      summary: "The basic shapes every graph is built from, and the symmetry that each one has or lacks.",
      blocks: [
        {
          kind: "text",
          body: md`Almost every function you will meet is built from a short list of basic ones: shifted, stretched, reflected (Algebra 2, Unit 1), added, multiplied or composed (next lesson). Those basic functions are the **parent functions**. Knowing each parent's shape, domain and range by heart means you can sketch and reason about thousands of functions without plotting a single point.`,
        },
        {
          kind: "key",
          title: "The parent functions",
          body: md`- **Constant** $f(x) = c$: a horizontal line. Domain all reals, range $\{c\}$.
- **Identity** $f(x) = x$: the diagonal line. Domain and range all reals.
- **Square** $f(x) = x^2$: a parabola with vertex at the origin. Range $[0, \infty)$.
- **Cube** $f(x) = x^3$: flattens at the origin, then shoots off. Range all reals.
- **Square root** $f(x) = \sqrt{x}$: half a sideways parabola. Domain and range $[0, \infty)$.
- **Cube root** $f(x) = \sqrt[3]{x}$: a sideways cube. Domain and range all reals.
- **Absolute value** $f(x) = |x|$: a V with its corner at the origin. Range $[0, \infty)$.
- **Reciprocal** $f(x) = \frac{1}{x}$: two branches, with asymptotes $x = 0$ and $y = 0$. Domain and range: all reals except 0.
- **Exponential** $f(x) = e^{x}$: domain all reals, range $(0, \infty)$, asymptote $y = 0$.
- **Natural log** $f(x) = \ln x$: domain $(0, \infty)$, range all reals, asymptote $x = 0$.
- **Sine** $f(x) = \sin x$: a wave. Domain all reals, range $[-1, 1]$, period $2\pi$.`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-3, 5],
          curves: [
            { expr: "x", label: "y = x", color: 1 },
            { expr: "x^2", label: "y = x^2", color: 2 },
            { expr: "x^3", label: "y = x^3", color: 3 },
            { expr: "abs(x)", label: "y = |x|", color: 4 },
          ],
          caption: md`The polynomial parents and the absolute value. Notice how $x^2$ and $|x|$ sit entirely above the axis, while $x$ and $x^3$ pass through the origin and keep going down on the left.`,
        },
        {
          kind: "plot",
          x: [-4, 4],
          y: [-3, 3],
          curves: [
            { expr: "sqrt(x)", label: "y = \\sqrt{x}", color: 1 },
            { expr: "cbrt(x)", label: "y = \\sqrt[3]{x}", color: 2 },
            { expr: "1/x", label: "y = 1/x", color: 3 },
          ],
          caption: md`The square root starts at the origin and lives only on the right: a negative number has no real square root. The cube root exists for every input, because a negative number does have a real cube root. The reciprocal never touches either axis.`,
        },
        {
          kind: "plot",
          x: [-4, 4],
          y: [-3, 5],
          curves: [
            { expr: "e^x", label: "y = e^x", color: 1 },
            { expr: "ln(x)", label: "y = \\ln x", color: 2 },
            { expr: "sin(x)", label: "y = \\sin x", color: 3 },
          ],
          caption: md`$e^{x}$ and $\ln x$ are mirror images across the line $y = x$, because they are inverses (Algebra 2, Unit 6). The sine wave repeats every $2\pi \approx 6.28$ units.`,
        },
        {
          kind: "why",
          title: "Why 1/x has two asymptotes",
          body: md`Take $x$ close to 0, say $x = 0.001$. Then $\frac{1}{x} = 1000$. At $x = 0.000001$ it's a million. The closer the input gets to 0, the larger the output, without bound, so the graph hugs the line $x = 0$ and never crosses it (there is no output at 0 at all). From the left the same happens with negative values.

Now take $x$ huge, say $x = 1000$. Then $\frac1x = 0.001$: small, but never 0, because 1 divided by anything isn't 0. So the graph flattens toward the line $y = 0$ without touching it. Each asymptote is the same fact read in two directions: the reciprocal of a tiny number is huge, and the reciprocal of a huge number is tiny.`,
        },
        {
          kind: "text",
          body: md`Look at the parabola and the V: fold the picture along the $y$-axis and each graph lands on itself. Now look at $x^3$, $\sqrt[3]{x}$ and $\frac1x$: fold them and they don't match, but turn the page upside down (a half-turn about the origin) and they do. These two kinds of symmetry have names, and they can be tested with algebra instead of folding.`,
        },
        {
          kind: "key",
          title: "Even and odd functions",
          body: md`A function is **even** when $f(-x) = f(x)$ for every $x$ in its domain. Its graph is symmetric across the $y$-axis.

A function is **odd** when $f(-x) = -f(x)$ for every $x$ in its domain. Its graph is symmetric under a half-turn about the origin.

Most functions are **neither**. To test, replace every $x$ by $-x$ and simplify.`,
        },
        {
          kind: "why",
          title: "Why f(-x) = f(x) means mirror symmetry",
          body: md`Pick any point on the graph. It has the form $(a, f(a))$. Its mirror image across the $y$-axis is $(-a, f(a))$: same height, opposite side. Is that mirror point on the graph? It is exactly when the function's value at $-a$ is $f(a)$, that is, when $f(-a) = f(a)$. If this holds for every $a$, every point's mirror image is also on the graph, which is what "symmetric across the $y$-axis" means.

For odd functions the half-turn about the origin sends $(a, f(a))$ to $(-a, -f(a))$. That point is on the graph exactly when $f(-a) = -f(a)$.`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-4, 4],
          curves: [{ expr: "x^3 - 3x", label: "y = x^3 - 3x" }],
          points: [
            { x: "a", y: "a^3 - 3a", label: "(a, f(a))", color: 2 },
            { x: "-a", y: "-(a^3 - 3a)", label: "(-a, f(-a))", color: 3 },
          ],
          params: [{ name: "a", min: -2.4, max: 2.4, step: 0.1, value: 1.5 }],
          caption: md`Slide $a$. The point at $-a$ always has the opposite height: $f(-a) = -f(a)$, so $x^3 - 3x$ is odd. The two points are always a half-turn about the origin apart.`,
        },
        {
          kind: "example",
          title: "Testing three functions",
          problem: md`Classify $f(x) = x^4 - 3x^2$, $g(x) = x^3 + x$ and $h(x) = x^2 + x$ as even, odd or neither.`,
          steps: [
            { math: md`f(-x) = (-x)^4 - 3(-x)^2 = x^4 - 3x^2 = f(x)`, note: md`$(-x)^4 = x^4$ and $(-x)^2 = x^2$. So $f$ is **even**.` },
            { math: md`g(-x) = (-x)^3 + (-x) = -x^3 - x = -(x^3 + x) = -g(x)`, note: md`Every term flipped sign. So $g$ is **odd**.` },
            { math: md`h(-x) = (-x)^2 + (-x) = x^2 - x`, note: md`Not $h(x)$ (the $x$ term flipped) and not $-h(x) = -x^2 - x$ (the $x^2$ term didn't). **Neither.** Check with a number: $h(1) = 2$ but $h(-1) = 0$.` },
          ],
        },
        {
          kind: "why",
          title: "Why the names are even and odd",
          body: md`$(-x)^n = (-1)^n x^n$. When $n$ is even, $(-1)^n = 1$ and the sign vanishes; when $n$ is odd, $(-1)^n = -1$ and the sign survives. So a polynomial with only even powers (counting a constant as $x^0$) satisfies $f(-x) = f(x)$, and one with only odd powers satisfies $f(-x) = -f(x)$. The function names come from the exponents.

A polynomial that mixes the two kinds is neither: some terms flip and some don't, so $f(-x)$ can't be $f(x)$ or $-f(x)$.`,
        },
        {
          kind: "proof",
          title: "An odd function defined at 0 passes through the origin",
          given: md`$f$ is odd and $0$ is in its domain`,
          prove: md`$f(0) = 0$`,
          steps: [
            { statement: md`$f(-0) = -f(0)$`, reason: md`Definition of odd, with $x = 0$` },
            { statement: md`$f(0) = -f(0)$`, reason: md`$-0 = 0$` },
            { statement: md`$2 f(0) = 0$`, reason: md`Add $f(0)$ to both sides` },
            { statement: md`$f(0) = 0$`, reason: "Divide by 2" },
          ],
        },
        {
          kind: "text",
          body: md`That's why $x$, $x^3$, $\sqrt[3]{x}$ and $\sin x$ all pass through the origin, and why $\frac1x$ (odd, but not defined at 0) is allowed to skip it.

Among the parents: $x^2$, $|x|$ and the constants are even; $x$, $x^3$, $\sqrt[3]{x}$, $\frac1x$ and $\sin x$ are odd; $\sqrt{x}$, $e^{x}$ and $\ln x$ are neither. For $\sqrt{x}$ and $\ln x$ the reason is the domain: $f(-x)$ isn't even defined when $x > 0$, so no symmetry is possible. For $e^{x}$, $e^{-x} = \frac{1}{e^{x}}$, which is neither $e^{x}$ nor $-e^{x}$.`,
        },
        {
          kind: "check",
          prompt: md`Is $f(x) = x^3 - x$ even, odd or neither?`,
          choices: ["even", "odd", "neither"],
          accept: ["odd"],
          explain: md`$f(-x) = (-x)^3 - (-x) = -x^3 + x = -(x^3 - x) = -f(x)$. Only odd powers, so odd.`,
        },
        {
          kind: "check",
          prompt: md`A function $f$ is even and $f(4) = -7$. What is $f(-4)$?`,
          answer: "-7",
          explain: md`Even means $f(-x) = f(x)$, so $f(-4) = f(4) = -7$. The graph has a mirror-image point at the same height on the other side.`,
        },
      ],
      practice: [evaluateParent, classifySymmetry, rangeOfParent],
    },
    {
      id: slug("Combining functions"),
      title: "Combining functions",
      summary: "Adding, multiplying, dividing and composing functions, and what happens to the domain each time.",
      blocks: [
        {
          kind: "text",
          body: md`Two functions can be combined the same ways two numbers can. If a company's revenue is $R(t)$ and its costs are $C(t)$, its profit is $R(t) - C(t)$: at each moment, subtract the two numbers. Doing that for every input defines a new function, $R - C$. The arithmetic happens **output by output**.`,
        },
        {
          kind: "key",
          title: "Arithmetic with functions",
          body: md`For functions $f$ and $g$, define new functions by combining their outputs at each $x$:

$$(f + g)(x) = f(x) + g(x) \qquad (f - g)(x) = f(x) - g(x)$$
$$(fg)(x) = f(x)\,g(x) \qquad \left(\frac{f}{g}\right)(x) = \frac{f(x)}{g(x)}$$

The domain of $f + g$, $f - g$ and $fg$ is the set of $x$ in **both** domains. The domain of $\frac{f}{g}$ is that set with every $x$ where $g(x) = 0$ removed.`,
        },
        {
          kind: "plot",
          x: [-4, 6],
          y: [-4, 8],
          curves: [
            { expr: "x^2/4", label: "f(x) = x^2/4", color: 1 },
            { expr: "2 - x", label: "g(x) = 2 - x", color: 2 },
            { expr: "x^2/4 - x + 2", label: "(f + g)(x)", color: 3 },
          ],
          points: [
            { x: "a", y: "a^2/4", label: "f({a}) = {=a^2/4}", color: 1 },
            { x: "a", y: "2 - a", label: "g({a}) = {=2 - a}", color: 2 },
            { x: "a", y: "a^2/4 - a + 2", label: "{=a^2/4} + {=2 - a} = {=a^2/4 - a + 2}", color: 3 },
          ],
          params: [{ name: "a", min: -3, max: 5, step: 0.5, value: 3 }],
          caption: md`Slide $a$. At each input the green height is the blue height plus the orange height. The sum of two functions is built one input at a time, so the graph of $f + g$ comes from stacking heights, not from any formula trick.`,
        },
        {
          kind: "why",
          title: "Why the domain is the overlap",
          body: md`To compute $(f + g)(x)$ you need two numbers, $f(x)$ and $g(x)$, and then you add them. If either number doesn't exist, there's nothing to add. So $x$ must be in the domain of $f$ **and** in the domain of $g$. Adding, subtracting and multiplying two real numbers always works, so no further inputs are lost.

Division is the one operation that can fail on its own: $\frac{f(x)}{g(x)}$ has no value when $g(x) = 0$, even if both $f(x)$ and $g(x)$ exist. So the quotient loses those inputs too.`,
        },
        {
          kind: "example",
          title: "Domains of a sum and a quotient",
          problem: md`Let $f(x) = \sqrt{x - 1}$ and $g(x) = \frac{1}{x - 4}$. Find the domains of $f + g$, $\frac{f}{g}$ and $\frac{g}{f}$.`,
          steps: [
            { math: md`\text{dom } f = [1, \infty), \quad \text{dom } g = (-\infty, 4) \cup (4, \infty)`, note: "The root needs a radicand of 0 or more; the fraction needs a non-zero denominator (Algebra 2, Unit 1)." },
            { math: md`\text{dom}(f + g) = [1, 4) \cup (4, \infty)`, note: md`The overlap: $x \ge 1$ with the point $4$ removed.` },
            { math: md`\text{dom}\left(\tfrac{f}{g}\right) = [1, 4) \cup (4, \infty)`, note: md`Same overlap, and additionally $g(x) \ne 0$. But $\frac{1}{x - 4}$ is never 0, so nothing more goes.` },
            { math: md`\text{dom}\left(\tfrac{g}{f}\right) = (1, 4) \cup (4, \infty)`, note: md`Now $f$ is the denominator, and $f(1) = \sqrt{0} = 0$. So $1$ is removed as well: the bracket becomes a parenthesis.` },
          ],
        },
        {
          kind: "why",
          title: "Why simplifying doesn't give back lost inputs",
          body: md`Let $f(x) = x^2 - 4$ and $g(x) = x - 2$. Then $\left(\frac{f}{g}\right)(x) = \frac{x^2 - 4}{x - 2} = \frac{(x - 2)(x + 2)}{x - 2}$, and cancelling gives $x + 2$. It's tempting to say the domain is all reals. It isn't.

The quotient is defined by its recipe: compute $f(2) = 0$, compute $g(2) = 0$, divide. That division fails. The cancelled formula $x + 2$ agrees with $\frac{f}{g}$ at every other input, but the quotient function has a hole at $x = 2$, just like the rational functions of Algebra 2, Unit 4. The domain of $\frac{f}{g}$ is $(-\infty, 2) \cup (2, \infty)$.`,
        },
        {
          kind: "text",
          body: md`The fifth way to combine functions is **composition**: feed one function's output into another. You met it in Algebra 2, Unit 1. Here we revisit it with a sharper eye on the domain.`,
        },
        {
          kind: "key",
          title: "Composition and its domain",
          body: md`$$(f \circ g)(x) = f(g(x))$$

Read it inside out: $g$ acts first, then $f$ acts on the result. An input $x$ is in the domain of $f \circ g$ when two things hold:

- $x$ is in the domain of $g$, so that $g(x)$ exists, and
- $g(x)$ is in the domain of $f$, so that $f$ can accept it.

The second condition is the one people forget, and it's sometimes invisible in the simplified formula.`,
        },
        {
          kind: "example",
          title: "Order matters",
          problem: md`Let $f(x) = \sqrt{x}$ and $g(x) = x - 3$. Find $(f \circ g)(x)$ and $(g \circ f)(x)$ with their domains.`,
          steps: [
            { math: md`(f \circ g)(x) = f(x - 3) = \sqrt{x - 3}`, note: md`Put the whole of $g(x)$ into $f$.` },
            { math: md`\text{dom}(f \circ g) = [3, \infty)`, note: md`$g$ accepts everything; $f$ needs $g(x) = x - 3 \ge 0$.` },
            { math: md`(g \circ f)(x) = g(\sqrt{x}) = \sqrt{x} - 3`, note: md`Now $f$ goes first.` },
            { math: md`\text{dom}(g \circ f) = [0, \infty)`, note: md`$f$ needs $x \ge 0$; $g$ accepts any output. Different formula, different domain: composition is not commutative.` },
          ],
        },
        {
          kind: "plot",
          x: [-4, 4],
          y: [-1, 9],
          curves: [
            { expr: "(x + 1)^2", label: "y = f(g(x)) = (x + 1)^2", color: 1 },
            { expr: "x^2 + 1", label: "y = g(f(x)) = x^2 + 1", color: 2 },
          ],
          caption: md`With $f(x) = x^2$ and $g(x) = x + 1$: adding 1 then squaring shifts the parabola left; squaring then adding 1 shifts it up. Same two functions, different order, different graphs.`,
        },
        {
          kind: "example",
          title: "A hidden restriction",
          problem: md`Let $f(x) = x^2$ and $g(x) = \sqrt{x}$. Find $(f \circ g)(x)$ and its domain.`,
          steps: [
            { math: md`(f \circ g)(x) = (\sqrt{x})^2 = x`, note: "The formula simplifies to the identity." },
            { math: md`\text{dom}(f \circ g) = [0, \infty)`, note: md`But $g$ only accepts $x \ge 0$, and that restriction stays. The graph of $f \circ g$ is the line $y = x$ cut off at the origin, not the whole line.` },
          ],
        },
        {
          kind: "text",
          body: md`The symmetry of the last lesson behaves predictably under these operations. Here is one case, proved from the definitions; the others go the same way.`,
        },
        {
          kind: "proof",
          title: "The product of two odd functions is even",
          given: md`$f$ and $g$ are odd: $f(-x) = -f(x)$ and $g(-x) = -g(x)$`,
          prove: md`$fg$ is even: $(fg)(-x) = (fg)(x)$`,
          steps: [
            { statement: md`$(fg)(-x) = f(-x)\,g(-x)$`, reason: "Definition of the product function" },
            { statement: md`$= (-f(x))(-g(x))$`, reason: md`$f$ and $g$ are odd` },
            { statement: md`$= f(x)\,g(x)$`, reason: "A negative times a negative is positive" },
            { statement: md`$= (fg)(x)$`, reason: "Definition of the product function" },
          ],
        },
        {
          kind: "text",
          body: md`In the same way: even times even is even, even times odd is odd, and the sum of two even functions is even (the sum of two odd functions is odd). The pattern matches multiplying signs, which is no accident: $x^m \cdot x^n = x^{m + n}$, and the parity of $m + n$ follows the usual rules for adding even and odd numbers.

For composition, if $g$ is even then $f \circ g$ is even whatever $f$ is, because $f(g(-x)) = f(g(x))$. Try proving it in one line.`,
        },
        {
          kind: "check",
          prompt: md`Let $f(x) = x^2 + 1$ and $g(x) = 2x - 3$. Find $(f \circ g)(2)$.`,
          answer: "2",
          explain: md`Inside first: $g(2) = 4 - 3 = 1$. Then $f(1) = 1 + 1 = 2$.`,
        },
        {
          kind: "check",
          prompt: md`Let $f(x) = x + 5$ and $g(x) = x^2 - 9$. Find the domain of $\left(\frac{f}{g}\right)(x)$. ${FMT}`,
          answer: "(-inf, -3) U (-3, 3) U (3, inf)",
          form: "inequality",
          explain: md`Both are polynomials, defined everywhere. The quotient fails where $g(x) = x^2 - 9 = 0$, at $x = 3$ and $x = -3$. Remove both.`,
        },
      ],
      practice: [combineValue, combineFormula, combinedDomain],
    },
    {
      id: slug("Piecewise functions"),
      title: "Piecewise functions",
      summary: "Functions defined by different rules on different stretches of input: evaluating, graphing, step functions, and where the pieces meet.",
      blocks: [
        {
          kind: "text",
          body: md`A taxi charges a flat 4 dollars for the first mile and 2 dollars per mile after that. Income tax uses one rate up to a threshold and a higher rate above it. A parking garage charges per hour or part of an hour. None of these is a single formula, yet each is a perfectly good function: every input has exactly one output. The rule just changes depending on where the input lies.`,
        },
        {
          kind: "key",
          title: "Piecewise functions",
          body: md`A **piecewise function** is defined by two or more formulas, each used on its own part of the domain:

$$f(x) = \begin{cases} x + 3 & \text{if } x < -1 \\ x^2 & \text{if } -1 \le x < 2 \\ 2 & \text{if } x \ge 2 \end{cases}$$

To evaluate $f(a)$: find the **one** condition that $a$ satisfies, then use that formula alone. Ignore the other pieces completely.`,
        },
        {
          kind: "why",
          title: "Why it's still one function",
          body: md`A function must give every input exactly one output. A piecewise definition does this as long as the conditions **don't overlap** and together **cover** the whole domain. Then each input belongs to exactly one piece and gets exactly one value.

The boundary points are where care is needed. Above, $x = -1$ belongs to the middle piece (its condition says $-1 \le x$), not to the first (which says $x < -1$, strictly). If both conditions had included $-1$, the two formulas would give $2$ and $1$ for the same input, and the rule wouldn't be a function.`,
        },
        {
          kind: "example",
          title: "Evaluating, including at the seams",
          problem: md`For the function $f$ in the box above, find $f(-4)$, $f(-1)$, $f(1)$, $f(2)$ and $f(5)$.`,
          steps: [
            { math: md`f(-4) = -4 + 3 = -1`, note: md`$-4 < -1$, so the first piece.` },
            { math: md`f(-1) = (-1)^2 = 1`, note: md`$-1$ satisfies $-1 \le x < 2$, the middle piece. Not $-1 + 3 = 2$: the first condition is strict.` },
            { math: md`f(1) = 1^2 = 1`, note: "Middle piece." },
            { math: md`f(2) = 2`, note: md`$2$ satisfies $x \ge 2$, the last piece. The middle condition stops short of 2.` },
            { math: md`f(5) = 2`, note: "Last piece. A constant piece ignores the input." },
          ],
        },
        {
          kind: "plot",
          x: [-5, 5],
          y: [-3, 5],
          curves: [
            { expr: "x + 3", domain: [-5, -1], color: 1, label: "x + 3" },
            { expr: "x^2", domain: [-1, 2], color: 2, label: "x^2" },
            { expr: "2", domain: [2, 5], color: 3, label: "2" },
          ],
          points: [
            { x: -1, y: 2, open: true, color: 1 },
            { x: -1, y: 1, color: 2 },
            { x: 2, y: 4, open: true, color: 2 },
            { x: 2, y: 2, color: 3 },
          ],
          caption: md`The graph of $f$. A filled dot marks an endpoint that belongs to the piece; an open dot marks one that doesn't. Above each $x$ there is exactly one filled point or curve, which is the vertical line test passing.`,
        },
        {
          kind: "text",
          body: md`**Graphing** a piecewise function means drawing each formula only over its own stretch. At a boundary, draw a filled dot where the condition includes the endpoint ($\le$ or $\ge$) and an open dot where it doesn't ($<$ or $>$). If the two pieces happen to give the same value there, the dots coincide and the graph is unbroken; otherwise it **jumps**.`,
        },
        {
          kind: "key",
          title: "Absolute value is piecewise",
          body: md`$$|x| = \begin{cases} x & \text{if } x \ge 0 \\ -x & \text{if } x < 0 \end{cases}$$

Any function with absolute value bars can be rewritten without them by splitting at the point where the inside is 0. For $|2x - 6|$: the inside is 0 at $x = 3$, so $|2x - 6| = 2x - 6$ for $x \ge 3$ and $|2x - 6| = -(2x - 6) = 6 - 2x$ for $x < 3$.`,
        },
        {
          kind: "why",
          title: "Why the second piece is -x",
          body: md`$|x|$ is the distance from $x$ to 0, and a distance is never negative. For $x \ge 0$ the distance is $x$ itself. For a negative $x$, say $x = -5$, the distance is $5$, which is the **opposite** of $x$: $-(-5) = 5$. So on negative inputs $|x| = -x$, and $-x$ is a positive number there. The minus sign doesn't make the output negative; it undoes a negative input.`,
        },
        {
          kind: "proof",
          title: "The square root of a square is the absolute value",
          given: md`$x$ is any real number`,
          prove: md`$\sqrt{x^2} = |x|$`,
          steps: [
            { statement: md`Case 1: $x \ge 0$. Then $|x| = x$.`, reason: "Definition of absolute value, first piece" },
            { statement: md`$\sqrt{x^2} = x$`, reason: md`$x$ is a non-negative number whose square is $x^2$, and $\sqrt{\;}$ means the non-negative root` },
            { statement: md`So $\sqrt{x^2} = |x|$ in Case 1.`, reason: "Both equal $x$" },
            { statement: md`Case 2: $x < 0$. Then $|x| = -x$, and $-x > 0$.`, reason: "Definition of absolute value, second piece" },
            { statement: md`$(-x)^2 = x^2$`, reason: "A negative times a negative is positive" },
            { statement: md`$\sqrt{x^2} = -x$`, reason: md`$-x$ is the non-negative number whose square is $x^2$` },
            { statement: md`So $\sqrt{x^2} = |x|$ in Case 2.`, reason: "Both equal $-x$" },
            { statement: md`$\sqrt{x^2} = |x|$ for every real $x$.`, reason: "The two cases cover every real number" },
          ],
        },
        {
          kind: "plot",
          x: [-4, 4],
          y: [-1, 4],
          curves: [
            { expr: "-x", domain: [-4, 0], color: 2, label: "y = -x \\text{ for } x < 0" },
            { expr: "x", domain: [0, 4], color: 1, label: "y = x \\text{ for } x \\ge 0" },
          ],
          points: [{ x: 0, y: 0, color: 1 }],
          caption: md`The V of $|x|$ is two half-lines. The left half is a piece of $y = -x$, which has positive height when $x$ is negative. The pieces meet at the origin, so there's no jump.`,
        },
        {
          kind: "text",
          body: md`**Step functions** are piecewise functions whose pieces are all constants. The most important one is the **greatest integer function** (or **floor**), $\lfloor x \rfloor$: the greatest integer that is less than or equal to $x$. So $\lfloor 3.7 \rfloor = 3$, $\lfloor 5 \rfloor = 5$ and $\lfloor -2.3 \rfloor = -3$ (not $-2$: the integer *below* $-2.3$ is $-3$). Its companion the **ceiling**, $\lceil x \rceil$, is the least integer greater than or equal to $x$: $\lceil 3.2 \rceil = 4$, $\lceil -2.3 \rceil = -2$.`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-3, 3],
          curves: Array.from({ length: 6 }, (_, i) => ({ expr: String(i - 3), domain: [i - 3, i - 2] as [number, number], color: 1 as const })),
          points: Array.from({ length: 6 }, (_, i) => [
            { x: i - 3, y: i - 3, color: 1 as const },
            { x: i - 2, y: i - 3, open: true, color: 1 as const },
          ]).flat(),
          caption: md`$y = \lfloor x \rfloor$. Each step is flat on $[n, n + 1)$ at height $n$: filled at the left end, open at the right. The function jumps by 1 at every integer.`,
        },
        {
          kind: "example",
          title: "A cost that jumps",
          problem: md`A garage charges 3 dollars for each hour or any part of an hour. Write the cost $C$ of a stay of $t$ hours, and find the cost of 2 hours 10 minutes.`,
          steps: [
            { math: md`C(t) = 3 \lceil t \rceil`, note: "Any part of an hour counts as a whole hour, so round the time up to an integer, then charge per hour." },
            { math: md`t = 2\tfrac{10}{60} \approx 2.17, \qquad \lceil 2.17 \rceil = 3`, note: "Just over 2 hours is billed as 3." },
            { math: md`C = 3 \cdot 3 = 9`, note: "9 dollars. Staying 1 more minute past 3 hours would jump the cost to 12." },
          ],
        },
        {
          kind: "key",
          title: "Where the pieces meet",
          body: md`At a boundary $x = c$ between two pieces, the graph is **unbroken** when both formulas give the same value at $c$. Otherwise it jumps. Setting the two formulas equal at $c$ and solving is how you choose a constant that makes a piecewise graph connect. (In Unit 8 this idea becomes *continuity*.)`,
        },
        {
          kind: "example",
          title: "Choosing a constant so the pieces connect",
          problem: md`Find $k$ so that $f(x) = \begin{cases} x^2 + 1 & \text{if } x < 2 \\ kx - 3 & \text{if } x \ge 2 \end{cases}$ has no jump at $x = 2$.`,
          steps: [
            { math: md`2^2 + 1 = 5`, note: md`What the left formula gives as $x$ reaches 2.` },
            { math: md`k(2) - 3 = 5`, note: "The right formula must give the same value at 2." },
            { math: md`k = 4`, note: md`Check: $4 \cdot 2 - 3 = 5$. The parabola hands off to the line at the point $(2, 5)$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`$$g(x) = \begin{cases} 5 - x & \text{if } x \le 1 \\ x^2 + 2 & \text{if } x > 1 \end{cases}$$ Find $g(1)$.`,
          answer: "4",
          explain: md`$x = 1$ satisfies $x \le 1$ (the $\le$ includes 1), so use the first piece: $5 - 1 = 4$. The second piece would give 3, but its condition is strict.`,
        },
        {
          kind: "check",
          prompt: md`Evaluate $\lfloor -1.5 \rfloor$.`,
          answer: "-2",
          explain: md`The greatest integer that is at most $-1.5$ is $-2$. On the number line, $-2 \le -1.5 < -1$, and the floor is the integer on the left.`,
        },
      ],
      practice: [piecewiseValue, stepFunction, joinPieces],
    },
    {
      id: slug("Rates of change"),
      title: "Rates of change",
      summary: "Average rate of change as a secant slope, the difference quotient, and the first step on the road to calculus.",
      blocks: [
        {
          kind: "text",
          body: md`How fast is a function changing? For a line the answer is its slope, one number, the same everywhere. For a curve the answer depends on where you look: $y = x^2$ barely moves near $x = 0$ and climbs steeply near $x = 10$. So we start with a question that has a clean answer: how fast, **on average**, does $f$ change between two inputs?`,
        },
        {
          kind: "key",
          title: "Average rate of change",
          body: md`The average rate of change of $f$ on the interval $[a, b]$ is

$$\frac{f(b) - f(a)}{b - a},$$

the change in output divided by the change in input. Its units are output units per input unit: meters per second, dollars per item.`,
        },
        {
          kind: "why",
          title: "Why it's a slope",
          body: md`The points $(a, f(a))$ and $(b, f(b))$ both lie on the graph. The slope of the line through two points is rise over run (Algebra 1): $\frac{f(b) - f(a)}{b - a}$. That's the same quotient. So the average rate of change is the slope of the line through the two endpoints, called the **secant line**.

If a car covers 120 miles in 2 hours, its average speed is 60 miles per hour, even if it stopped for coffee. That's $\frac{f(2) - f(0)}{2 - 0}$ with $f$ the distance travelled. The secant slope says nothing about the speed at any particular instant.`,
        },
        {
          kind: "plot",
          x: [-1, 5],
          y: [-1, 11],
          curves: [
            { expr: "x^2/2", label: "f(x) = x^2/2", color: 1 },
            { expr: "a^2/2 + ((a + b)/2)(x - a)", label: "\\text{secant}", color: 2, dashed: true },
          ],
          points: [
            { x: "a", y: "a^2/2", label: "({a}, {=a^2/2})", color: 2 },
            { x: "b", y: "b^2/2", label: "({b}, {=b^2/2})", color: 2 },
          ],
          params: [
            { name: "a", min: -1, max: 2, step: 0.5, value: 1 },
            { name: "b", min: 2.5, max: 4.5, step: 0.5, value: 3 },
          ],
          caption: md`The secant line through two points of $y = \frac{x^2}{2}$. Its slope, the average rate of change on $[a, b]$, is **{=(a + b)/2}**. Slide $a$ and $b$: further right, the curve is steeper and the average rate grows.`,
        },
        {
          kind: "example",
          title: "Shrinking the interval",
          problem: md`Find the average rate of change of $f(x) = x^2$ on $[1, 3]$, then on $[1, 1.5]$, then on $[1, 1.1]$.`,
          steps: [
            { math: md`\frac{f(3) - f(1)}{3 - 1} = \frac{9 - 1}{2} = 4`, note: md`On $[1, 3]$.` },
            { math: md`\frac{f(1.5) - f(1)}{1.5 - 1} = \frac{2.25 - 1}{0.5} = 2.5`, note: md`On $[1, 1.5]$.` },
            { math: md`\frac{f(1.1) - f(1)}{1.1 - 1} = \frac{1.21 - 1}{0.1} = 2.1`, note: md`On $[1, 1.1]$. The answers $4, 2.5, 2.1$ are settling toward 2. Hold that thought.` },
          ],
        },
        {
          kind: "proof",
          title: "A line's average rate of change is its slope on every interval",
          given: md`$f(x) = mx + c$ and $a \ne b$`,
          prove: md`$\dfrac{f(b) - f(a)}{b - a} = m$`,
          steps: [
            { statement: md`$f(b) - f(a) = (mb + c) - (ma + c)$`, reason: "Evaluate the formula at each endpoint" },
            { statement: md`$= mb - ma$`, reason: md`The $c$'s cancel` },
            { statement: md`$= m(b - a)$`, reason: "Distributive property" },
            { statement: md`$\dfrac{f(b) - f(a)}{b - a} = \dfrac{m(b - a)}{b - a} = m$`, reason: md`Divide by $b - a$, which isn't 0 since $a \ne b$` },
          ],
        },
        {
          kind: "why",
          title: "Why a parabola has no single rate",
          body: md`Do the same computation for $f(x) = x^2$:

$$\frac{f(b) - f(a)}{b - a} = \frac{b^2 - a^2}{b - a} = \frac{(b - a)(b + a)}{b - a} = a + b.$$

The result still depends on $a$ and $b$. On $[1, 3]$ it's 4; on $[1, 1.5]$ it's 2.5; on $[1, 1.1]$ it's 2.1, matching the example. The interval never cancelled out, because the curve really does change at different rates in different places. Notice also what happens as $b$ creeps toward $a = 1$: the rate $1 + b$ creeps toward 2.`,
        },
        {
          kind: "text",
          body: md`It's useful to describe the interval by its left end $x$ and its width $h$, so the right end is $x + h$. Then the average rate of change from $x$ to $x + h$ is a single expression that works for every interval at once.`,
        },
        {
          kind: "key",
          title: "The difference quotient",
          body: md`$$\frac{f(x + h) - f(x)}{h}, \qquad h \ne 0$$

It is the average rate of change of $f$ on the interval from $x$ to $x + h$: the slope of the secant line through $(x, f(x))$ and $(x + h, f(x + h))$. "Simplify the difference quotient" means: substitute, expand, subtract, and cancel the $h$ in the denominator.`,
        },
        {
          kind: "example",
          title: "A quadratic",
          problem: md`Simplify the difference quotient of $f(x) = x^2 + 3x$.`,
          steps: [
            { math: md`f(x + h) = (x + h)^2 + 3(x + h) = x^2 + 2xh + h^2 + 3x + 3h`, note: md`Replace **every** $x$ by $(x + h)$, parentheses included, then expand.` },
            { math: md`f(x + h) - f(x) = 2xh + h^2 + 3h`, note: md`Subtract $x^2 + 3x$. Every term without an $h$ cancels. That always happens: $f(x + h)$ and $f(x)$ agree when $h = 0$.` },
            { math: md`\frac{h(2x + h + 3)}{h} = 2x + h + 3`, note: md`Factor out $h$ and cancel.` },
          ],
        },
        {
          kind: "why",
          title: "Why we may cancel the h",
          body: md`An interval has two different endpoints, so $h \ne 0$, and dividing by a non-zero number is always allowed: $\frac{h(2x + h + 3)}{h} = 2x + h + 3$ for every $h$ except 0. We never divided by zero.

But look at what we got. The original quotient is meaningless at $h = 0$ ($\frac{0}{0}$). The simplified form $2x + h + 3$ makes perfect sense there: it equals $2x + 3$. That is the whole trick of calculus in miniature. The simplified difference quotient tells you what the secant slopes are heading toward as the interval shrinks to nothing.`,
        },
        {
          kind: "example",
          title: "A reciprocal",
          problem: md`Simplify the difference quotient of $f(x) = \dfrac{1}{x}$.`,
          steps: [
            { math: md`f(x + h) - f(x) = \frac{1}{x + h} - \frac{1}{x} = \frac{x - (x + h)}{x(x + h)}`, note: "Common denominator." },
            { math: md`= \frac{-h}{x(x + h)}`, note: md`$x - x - h = -h$. Again every term without $h$ has cancelled.` },
            { math: md`\frac{1}{h} \cdot \frac{-h}{x(x + h)} = -\frac{1}{x(x + h)}`, note: md`Dividing by $h$ is multiplying by $\frac{1}{h}$. Cancel $h$. At $h = 0$ this would read $-\frac{1}{x^2}$.` },
          ],
        },
        {
          kind: "example",
          title: "A square root",
          problem: md`Simplify the difference quotient of $f(x) = \sqrt{x}$.`,
          steps: [
            { math: md`\frac{\sqrt{x + h} - \sqrt{x}}{h}`, note: md`No $h$ to cancel yet. Multiply top and bottom by the conjugate $\sqrt{x + h} + \sqrt{x}$.` },
            { math: md`\frac{(\sqrt{x + h} - \sqrt{x})(\sqrt{x + h} + \sqrt{x})}{h(\sqrt{x + h} + \sqrt{x})} = \frac{(x + h) - x}{h(\sqrt{x + h} + \sqrt{x})}`, note: md`$(p - q)(p + q) = p^2 - q^2$, and the squares remove the roots.` },
            { math: md`\frac{h}{h(\sqrt{x + h} + \sqrt{x})} = \frac{1}{\sqrt{x + h} + \sqrt{x}}`, note: md`Cancel $h$. At $h = 0$ this would read $\frac{1}{2\sqrt{x}}$.` },
          ],
        },
        {
          kind: "plot",
          x: [-1, 4],
          y: [-1, 10],
          curves: [
            { expr: "x^2", label: "f(x) = x^2", color: 1 },
            { expr: "a^2 + (2a + h)(x - a)", label: "\\text{secant}", color: 2 },
            { expr: "a^2 + 2a(x - a)", label: "\\text{tangent}", color: 3, dashed: true },
          ],
          points: [
            { x: "a", y: "a^2", label: "(x, f(x))", color: 2 },
            { x: "a + h", y: "(a + h)^2", label: "(x + h, f(x + h))", color: 2 },
          ],
          params: [
            { name: "a", tex: "x", min: 0.5, max: 2.5, step: 0.25, value: 1 },
            { name: "h", min: 0.1, max: 2, step: 0.1, value: 1.5 },
          ],
          caption: md`For $f(x) = x^2$ the difference quotient simplifies to $2x + h$. The secant slope is **{=2a + h}**. Slide $h$ toward 0: the secant swings toward the dashed line, whose slope **{=2a}** is what $2x + h$ becomes at $h = 0$. That dashed line is the tangent, and its slope is how fast the curve is changing at that one point.`,
        },
        {
          kind: "text",
          body: md`What you've just seen is the central idea of differential calculus. The average rate over a shrinking interval closes in on an **instantaneous** rate, the slope of the tangent line. Unit 8 makes "closes in on" precise with limits, and Calculus 1 builds everything else on it. For now, the skill to own is the algebra: simplify the difference quotient until the $h$ in the denominator is gone.`,
        },
        {
          kind: "check",
          prompt: md`Find the average rate of change of $f(x) = x^3$ on $[0, 2]$.`,
          answer: "4",
          explain: md`$\frac{f(2) - f(0)}{2 - 0} = \frac{8 - 0}{2} = 4$.`,
        },
        {
          kind: "check",
          prompt: md`Simplify the difference quotient $\frac{f(x + h) - f(x)}{h}$ for $f(x) = 5x - 2$.`,
          answer: "5",
          simplified: true,
          explain: md`$f(x + h) - f(x) = (5x + 5h - 2) - (5x - 2) = 5h$, and $\frac{5h}{h} = 5$. A line's rate of change is its slope, everywhere.`,
        },
      ],
      practice: [averageRate, differenceQuotientPoly, differenceQuotientRational],
    },
  ],
};
