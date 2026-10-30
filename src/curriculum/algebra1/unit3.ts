import { poly, signed, type Rng } from "../../math/random";
import { md, type Generator, type Step, type Unit } from "../types";
import { ALL_REALS, NO_SOLUTION } from "./unit2";

// ── Shared helpers ──────────────────────────────────────────────────────────

type Op = "<" | "<=" | ">" | ">=";
const OPS: readonly Op[] = ["<", "<=", ">", ">="];
const TEX: Record<Op, string> = { "<": "<", "<=": md`\le`, ">": ">", ">=": md`\ge` };
const FLIP: Record<Op, Op> = { "<": ">", "<=": ">=", ">": "<", ">=": "<=" };
/** The "less" direction of a strict or non-strict pair: > goes with <, >= with <=. */
const MIRROR: Record<Op, Op> = { "<": "<", "<=": "<=", ">": "<", ">=": "<=" };

const isLess = (op: Op) => op === "<" || op === "<=";
const isStrict = (op: Op) => op === "<" || op === ">";
const holds = (a: number, op: Op, b: number) => (op === "<" ? a < b : op === "<=" ? a <= b : op === ">" ? a > b : a >= b);

/** x (op) n in interval notation, as LaTeX. */
const rayTex = (op: Op, n: number | string) =>
  isLess(op) ? md`(-\infty, ${n}${op === "<" ? ")" : "]"}` : md`${op === ">" ? "(" : "["}${n}, \infty)`;
/** lo (op1) x (op2) hi in interval notation, as LaTeX. op1 and op2 are < or <=. */
const boxTex = (lo: number, op1: Op, op2: Op, hi: number) => md`${op1 === "<" ? "(" : "["}${lo}, ${hi}${op2 === "<" ? ")" : "]"}`;
/** x (lowOp) lo or x (highOp) hi, as a union in interval notation. */
const unionTex = (lowOp: Op, lo: number, highOp: Op, hi: number) => md`${rayTex(lowOp, lo)} \cup ${rayTex(highOp, hi)}`;

const ALL = "(-inf, inf)";
/**
 * Text answers for "every number works", including the interval typed out. These matter most when a
 * problem ships without a parsed `answer` (see specialInequality), so they cover the usual ways to type it.
 */
const ALL_TEXT = [...ALL_REALS, ALL, "(-infinity, infinity)", "-inf < x < inf", "-infinity < x < infinity"];
const EITHER = "Either an inequality or interval notation is fine.";
const SPECIAL = md`If no number works, type **no solution**; if every number works, type **all real numbers**.`;
const OR = md`\;\text{ or }\;`;

const shiftNote = (b: number, where?: string) =>
  md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} ${where ?? (b > 0 ? "from both sides" : "to both sides")}.`;

/** An inequality a x + b (op) c whose solution is x (want) n, with the steps that solve it. */
function linear(r: Rng, want: Op, n: number): { tex: string; steps: Step[] } {
  const a = r.coef(-6, 6);
  const b = r.nonzero(-9, 9);
  const op = a > 0 ? want : FLIP[want];
  const c = a * n + b;
  return {
    tex: md`${poly([[a, "x"], [b, ""]])} ${TEX[op]} ${c}`,
    steps: [
      { math: md`${a}x ${TEX[op]} ${c - b}`, note: md`${shiftNote(b)} The sign stays.` },
      {
        math: md`x ${TEX[want]} ${n}`,
        note: a > 0 ? md`Divide by ${a}, a positive number: no flip.` : md`Divide by $${a}$. It's negative, so the sign flips.`,
      },
    ],
  };
}

/** a(x + m) (op) c x + d with solution x (want) n, collected onto the left. */
function bothSides(r: Rng, want: Op, n: number, c: number, a: number): { tex: string; steps: Step[] } {
  const m = r.nonzero(-6, 6);
  const d = a * (n + m) - c * n;
  const k = a - c;
  const op = k > 0 ? want : FLIP[want];
  const steps: Step[] = [
    { math: md`${poly([[a, "x"], [a * m, ""]])} ${TEX[op]} ${poly([[c, "x"], [d, ""]])}`, note: "Distribute." },
    {
      math: md`${poly([[k, "x"]])} ${TEX[op]} ${d - a * m}`,
      note: md`${c > 0 ? "Subtract" : "Add"} $${poly([[Math.abs(c), "x"]])}$ and ${a * m > 0 ? "subtract" : "add"} ${Math.abs(a * m)} on both sides. Neither move flips the sign.`,
    },
  ];
  if (k !== 1) {
    steps.push({
      math: md`x ${TEX[want]} ${n}`,
      note: k > 0 ? md`Divide by ${k}, positive: no flip.` : md`Divide by $${k}$. It's negative, so the sign flips.`,
    });
  }
  return { tex: md`${a}(${poly([[1, "x"], [m, ""]])}) ${TEX[op]} ${poly([[c, "x"], [d, ""]])}`, steps };
}

/**
 * Solve |a x + b| (op) rr for rr > 0, a > 0, where both (±rr - b)/a are integers.
 * Returns the answer text and the steps from splitting onward.
 */
function absSolve(a: number, b: number, op: Op, rr: number): { answer: string; steps: Step[] } {
  const inner = poly([[a, "x"], [b, ""]]);
  const ax = poly([[a, "x"]]);
  const s1 = (-rr - b) / a;
  const s2 = (rr - b) / a;
  const steps: Step[] = [];
  if (isLess(op)) {
    const t = TEX[op];
    steps.push({
      math: md`-${rr} ${t} ${inner} ${t} ${rr}`,
      note: md`The inside is ${op === "<" ? "less than" : "at most"} ${rr} from 0, so it lies between $-${rr}$ and $${rr}$: one stretch, an "and".`,
    });
    if (b !== 0 && a !== 1) steps.push({ math: md`${-rr - b} ${t} ${ax} ${t} ${rr - b}`, note: shiftNote(b, "in all three parts") });
    steps.push({ math: md`${s1} ${t} x ${t} ${s2}`, note: a === 1 ? shiftNote(b, "in all three parts") : md`Divide all three parts by ${a}.` });
    steps.push({ math: boxTex(s1, op, op, s2), note: "In interval notation." });
    return { answer: `${s1} ${op} x ${op} ${s2}`, steps };
  }
  const low = MIRROR[op];
  steps.push({
    math: md`${inner} ${TEX[low]} -${rr} ${OR} ${inner} ${TEX[op]} ${rr}`,
    note: md`The inside is ${op === ">" ? "more than" : "at least"} ${rr} from 0, so it is past $-${rr}$ on the left or past $${rr}$ on the right: two pieces, an "or".`,
  });
  if (b !== 0 && a !== 1) steps.push({ math: md`${ax} ${TEX[low]} ${-rr - b} ${OR} ${ax} ${TEX[op]} ${rr - b}`, note: shiftNote(b, "in both pieces") });
  steps.push({ math: md`x ${TEX[low]} ${s1} ${OR} x ${TEX[op]} ${s2}`, note: a === 1 ? shiftNote(b, "in both pieces") : md`Divide both pieces by ${a}.` });
  steps.push({ math: unionTex(low, s1, op, s2), note: md`In interval notation, joined with $\cup$.` });
  return { answer: `x ${low} ${s1} or x ${op} ${s2}`, steps };
}

/** Pick a > 0 and integers so that |a x + b| = rr has integer solutions s1 < s2. */
function absIntegerSetup(r: Rng): { a: number; b: number; rr: number; s1: number; s2: number } {
  const a = r.int(2, 4);
  const d = a % 2 ? r.pick([2, 4]) : r.int(1, 4);
  const rr = (a * d) / 2;
  let s2 = r.int(-4, 6);
  let b = rr - a * s2;
  while (b === 0) {
    s2 = r.int(-4, 6);
    b = rr - a * s2;
  }
  return { a, b, rr, s1: s2 - d, s2 };
}

// ── Lesson 1 practice ───────────────────────────────────────────────────────

const PHRASES: [string, Op, string][] = [
  ["is at least", ">=", `"At least" means that amount or more. The amount itself counts.`],
  ["is at most", "<=", `"At most" means that amount or less. The amount itself counts.`],
  ["is more than", ">", `"More than" means strictly bigger. The amount itself doesn't count.`],
  ["is less than", "<", `"Less than" means strictly smaller. The amount itself doesn't count.`],
  ["is no more than", "<=", `"No more than" means it can't go above the amount: that amount or less.`],
  ["is no less than", ">=", `"No less than" means it can't go below the amount: that amount or more.`],
  ["exceeds", ">", `"Exceeds" means is bigger than.`],
  ["is below", "<", `"Below" means to the left on the number line: smaller.`],
  ["is greater than or equal to", ">=", `Bigger, or exactly equal.`],
];

const OP_NOTE: Record<Op, string> = {
  ">": md`Strictly bigger, so the boundary itself is left out: $>$.`,
  ">=": md`The boundary counts too, so use $\ge$.`,
  "<": md`Strictly smaller, so the boundary itself is left out: $<$.`,
  "<=": md`The boundary counts too, so use $\le$.`,
};

const CONTEXTS: ((r: Rng) => { text: string; v: string; op: Op; n: number; hint: string })[] = [
  (r) => {
    const n = r.int(40, 54);
    return { text: md`To go on a ride you must be at least ${n} inches tall. Write the allowed heights $h$.`, v: "h", op: ">=", n, hint: `"At least ${n}" means ${n} or taller.` };
  },
  (r) => {
    const n = r.int(-12, -1);
    return { text: md`All night the temperature stayed below $${n}$ degrees. Write the possible temperatures $T$.`, v: "T", op: "<", n, hint: `"Below" means less than, and ${n} itself is not included.` };
  },
  (r) => {
    const n = r.pick([100, 250, 500, 1000]);
    return { text: md`A bank charges a fee unless an account holds more than ${n} dollars. Write the balances $b$ that avoid the fee.`, v: "b", op: ">", n, hint: `"More than ${n}" leaves out ${n} itself.` };
  },
  (r) => {
    const n = r.int(20, 30);
    return { text: md`A fish tank must stay at ${n} degrees or cooler. Write the safe temperatures $T$.`, v: "T", op: "<=", n, hint: `"${n} or cooler" means ${n} or any lower number.` };
  },
];

const wordsToInequality: Generator = (r) => {
  if (r.next() < 0.35) {
    const c = r.pick(CONTEXTS)(r);
    return {
      prompt: md`${c.text} ${EITHER}`,
      answer: `${c.v} ${c.op} ${c.n}`,
      form: "inequality",
      hint: c.hint,
      solution: [
        { math: md`${c.v} ${TEX[c.op]} ${c.n}`, note: OP_NOTE[c.op] },
        { math: rayTex(c.op, c.n), note: "The same set in interval notation." },
      ],
    };
  }
  const [phrase, op, hint] = r.pick(PHRASES);
  const n = r.int(-12, 12);
  return {
    prompt: md`Write an inequality for: **$x$ ${phrase} $${n}$**. ${EITHER}`,
    answer: `x ${op} ${n}`,
    form: "inequality",
    hint,
    solution: [
      { math: md`x ${TEX[op]} ${n}`, note: OP_NOTE[op] },
      { math: rayTex(op, n), note: md`The same set in interval notation. ${isStrict(op) ? "Parenthesis" : "Bracket"} at ${n}, and always a parenthesis at $\infty$.` },
    ],
  };
};

const readingSolutionSets: Generator = (r) => {
  const kind = r.int(0, 2);
  const op = r.pick(OPS);
  if (kind === 0) {
    const n = r.int(-9, 9);
    return {
      prompt: md`A number line has ${isStrict(op) ? "an **open**" : "a **closed**"} circle at $${n}$ and is shaded to the **${isLess(op) ? "left" : "right"}**. Write the set it shows. ${EITHER}`,
      answer: `x ${op} ${n}`,
      form: "inequality",
      hint: "Left means smaller and right means larger. An open circle leaves the endpoint out; a closed one includes it.",
      solution: [
        {
          math: md`x ${TEX[op]} ${n}`,
          note: md`Shaded ${isLess(op) ? "left: smaller" : "right: larger"} numbers. ${isStrict(op) ? `Open circle: ${n} is left out, so no "or equal".` : `Closed circle: ${n} is included, so use "or equal".`}`,
        },
        { math: rayTex(op, n), note: "In interval notation." },
      ],
    };
  }
  if (kind === 1) {
    const half = r.next() < 0.4;
    const k = r.int(-8, 8);
    const n = half ? k + 0.5 : k;
    const ans = isLess(op) ? (half ? k : op === "<" ? k - 1 : k) : half ? k + 1 : op === ">" ? k + 1 : k;
    const which = isLess(op) ? "largest" : "smallest";
    const why = half
      ? `${n} isn't an integer, so the nearest integer on the shaded side is ${ans}.`
      : isStrict(op)
        ? `${n} itself is left out, so step one integer to the ${isLess(op) ? "left" : "right"}: ${ans}.`
        : `${n} itself is included, so it is the ${which} one.`;
    return {
      prompt: md`What is the ${which} integer that satisfies $x ${TEX[op]} ${n}$?`,
      answer: String(ans),
      hint: md`Picture the shading. Is $${n}$ itself included? Is it an integer?`,
      solution: [
        { math: md`x ${TEX[op]} ${n}`, note: md`The solutions run off to the ${isLess(op) ? "left" : "right"}, so the ${which} one sits at the boundary end.` },
        { math: String(ans), note: why },
      ],
    };
  }
  const n = r.int(-8, 8);
  const c = n + r.pick([0, 0, 1, -1, 3, -3]);
  const yes = holds(c, op, n);
  const reason =
    c === n
      ? isStrict(op)
        ? "The boundary itself is excluded by a strict sign."
        : `The "or equal" part makes the boundary count.`
      : `${c} is to the ${c < n ? "left" : "right"} of ${n}, so it is ${c < n ? "smaller" : "larger"}.`;
  return {
    prompt: md`Is $x = ${c}$ a solution of $x ${TEX[op]} ${n}$? Type **yes** or **no**.`,
    accept: [yes ? "yes" : "no"],
    hint: "Substitute the number and ask whether the statement is true.",
    solution: [
      { math: md`${c} ${TEX[op]} ${n}`, note: md`Substitute. This is ${yes ? "true" : "false"}. ${reason}` },
      { math: md`\text{${yes ? "yes" : "no"}}`, note: "" },
    ],
  };
};

// ── Lesson 2 practice ───────────────────────────────────────────────────────

const oneStepInequality: Generator = (r) => {
  const n = r.int(-9, 9);
  const want = r.pick(OPS);
  const kind = r.int(0, 4);
  if (kind === 0) {
    const a = r.nonzero(-12, 12);
    return {
      prompt: md`Solve $${poly([[1, "x"], [a, ""]])} ${TEX[want]} ${n + a}$. ${EITHER}`,
      answer: `x ${want} ${n}`,
      form: "inequality",
      hint: md`Undo the ${a > 0 ? "addition" : "subtraction"}. Adding or subtracting never flips the sign.`,
      solution: [
        { math: md`x ${TEX[want]} ${n}`, note: md`${shiftNote(a)} Sliding both sides the same way keeps their order.` },
        { math: rayTex(want, n), note: "In interval notation." },
      ],
    };
  }
  if (kind === 1) {
    const a = r.coef(2, 9);
    return {
      prompt: md`Solve $${a}x ${TEX[want]} ${a * n}$. ${EITHER}`,
      answer: `x ${want} ${n}`,
      form: "inequality",
      hint: md`Divide both sides by ${a}. Is ${a} positive or negative?`,
      solution: [
        { math: md`\frac{${a}x}{${a}} ${TEX[want]} \frac{${a * n}}{${a}}`, note: md`Divide both sides by ${a}. It's positive, so the sign stays.` },
        { math: md`x ${TEX[want]} ${n}`, note: "" },
      ],
    };
  }
  if (kind === 2 || kind === 3) {
    const a = -r.coef(2, 9);
    const op = FLIP[want];
    return {
      prompt: md`Solve $${a}x ${TEX[op]} ${a * n}$. ${EITHER}`,
      answer: `x ${want} ${n}`,
      form: "inequality",
      hint: md`You'll divide by $${a}$, a negative number. What does that do to the sign?`,
      solution: [
        { math: md`\frac{${a}x}{${a}} ${TEX[want]} \frac{${a * n}}{${a}}`, note: md`Divide both sides by $${a}$. It's negative, so $${TEX[op]}$ flips to $${TEX[want]}$.` },
        { math: md`x ${TEX[want]} ${n}`, note: md`Check with a number: try one on the shaded side in the original.` },
      ],
    };
  }
  const a = r.coef(2, 6) * r.sign();
  const m = r.int(-6, 6);
  const op = a > 0 ? want : FLIP[want];
  return {
    prompt: md`Solve $${a > 0 ? "" : "-"}\frac{x}{${Math.abs(a)}} ${TEX[op]} ${m}$. ${EITHER}`,
    answer: `x ${want} ${a * m}`,
    form: "inequality",
    hint: md`Multiply both sides by $${a}$.${a < 0 ? " Watch the sign." : ""}`,
    solution: [
      {
        math: md`x ${TEX[want]} ${a * m}`,
        note: a > 0 ? md`Multiply both sides by ${a}. It's positive, so no flip.` : md`Multiply both sides by $${a}$. It's negative, so the sign flips.`,
      },
      { math: rayTex(want, a * m), note: "In interval notation." },
    ],
  };
};

const multiStepInequality: Generator = (r) => {
  let n = r.int(-8, 8);
  const want = r.pick(OPS);
  const kind = r.int(0, 3);
  if (kind === 0) {
    const L = linear(r, want, n);
    return {
      prompt: md`Solve $${L.tex}$. ${EITHER}`,
      answer: `x ${want} ${n}`,
      form: "inequality",
      hint: "Undo the addition or subtraction first, then the multiplication. Flip only if you divide by a negative.",
      solution: L.steps,
    };
  }
  if (kind === 1) {
    const a = r.coef(2, 7);
    const b = r.int(1, 15);
    const op = FLIP[want];
    const c = b - a * n;
    return {
      prompt: md`Solve $${b} - ${a}x ${TEX[op]} ${c}$. ${EITHER}`,
      answer: `x ${want} ${n}`,
      form: "inequality",
      hint: md`The minus sign belongs to the $${a}x$: its coefficient is $-${a}$.`,
      solution: [
        { math: md`-${a}x ${TEX[op]} ${c - b}`, note: md`Subtract ${b} from both sides. The sign stays.` },
        { math: md`x ${TEX[want]} ${n}`, note: md`Divide by $-${a}$. It's negative, so the sign flips.` },
      ],
    };
  }
  if (kind === 2) {
    const a = r.coef(2, 6);
    let c = r.nonzero(-7, 7);
    while (c === a) c = r.nonzero(-7, 7);
    const B = bothSides(r, want, n, c, a);
    return {
      prompt: md`Solve $${B.tex}$. ${EITHER}`,
      answer: `x ${want} ${n}`,
      form: "inequality",
      hint: "Distribute, collect the x-terms on the left, then divide. Flip only if the coefficient you divide by is negative.",
      solution: B.steps,
    };
  }
  const a = r.coef(2, 5);
  const b = r.nonzero(-9, 9);
  n = a * r.int(-4, 4);
  if (r.next() < 0.5) {
    return {
      prompt: md`Solve $\frac{x}{${a}} ${signed(b)} ${TEX[want]} ${n / a + b}$. ${EITHER}`,
      answer: `x ${want} ${n}`,
      form: "inequality",
      hint: md`Undo the ${b > 0 ? "addition" : "subtraction"} first, then multiply by ${a}.`,
      solution: [
        { math: md`\frac{x}{${a}} ${TEX[want]} ${n / a}`, note: shiftNote(b) },
        { math: md`x ${TEX[want]} ${n}`, note: md`Multiply by ${a}, positive: no flip.` },
      ],
    };
  }
  const op = FLIP[want];
  return {
    prompt: md`Solve $${b} - \frac{x}{${a}} ${TEX[op]} ${b - n / a}$. ${EITHER}`,
    answer: `x ${want} ${n}`,
    form: "inequality",
    hint: md`After moving the ${b}, the $x$-term is $-\frac{x}{${a}}$. You'll multiply by a negative.`,
    solution: [
      { math: md`-\frac{x}{${a}} ${TEX[op]} ${-n / a}`, note: shiftNote(b) },
      { math: md`x ${TEX[want]} ${n}`, note: md`Multiply both sides by $-${a}$. It's negative, so the sign flips.` },
    ],
  };
};

const specialInequality: Generator = (r) => {
  if (r.next() < 0.65) {
    const a = r.coef(2, 6);
    const m = r.nonzero(-5, 5);
    const op = r.pick(OPS);
    const k = a * m;
    const d = k + r.pick([-4, -3, -2, -1, 0, 0, 1, 2, 3, 4]);
    const yes = holds(k, op, d);
    const split = r.next() < 0.5;
    const right = split ? md`${poly([[a + 1, "x"], [d, ""]])} - x` : poly([[a, "x"], [d, ""]]);
    return {
      prompt: md`Solve $${a}(${poly([[1, "x"], [m, ""]])}) ${TEX[op]} ${right}$. ${EITHER} ${SPECIAL}`,
      // When k = d both sides are the same expression; the verifier's sampling hits rounding there, so leave that case to text answers.
      ...(yes ? { ...(k === d ? {} : { answer: ALL }), accept: ALL_TEXT } : { accept: NO_SOLUTION }),
      form: "inequality",
      hint: "Simplify both sides fully. If the x-terms cancel, is the statement that's left true or false?",
      solution: [
        { math: md`${poly([[a, "x"], [k, ""]])} ${TEX[op]} ${poly([[a, "x"], [d, ""]])}`, note: split ? "Distribute on the left, combine like terms on the right." : "Distribute." },
        { math: md`${k} ${TEX[op]} ${d}`, note: md`Subtract $${a}x$ from both sides. The $x$'s are gone, and the statement left is **${yes ? "true" : "false"}**.` },
        yes
          ? { math: md`\text{all real numbers}`, note: md`It's true whatever $x$ is, so every number works: $(-\infty, \infty)$.` }
          : { math: md`\text{no solution}`, note: md`It's false whatever $x$ is, so no number works.` },
      ],
    };
  }
  const a = r.coef(2, 6);
  const c = a + r.pick([1, -1, 2, -2]);
  const want = r.pick(OPS);
  const n = r.int(-7, 7);
  const B = bothSides(r, want, n, c, a);
  return {
    prompt: md`Solve $${B.tex}$. ${EITHER} ${SPECIAL}`,
    answer: `x ${want} ${n}`,
    form: "inequality",
    hint: "Simplify both sides fully. If the x-terms cancel, is the statement that's left true or false?",
    solution: [...B.steps.slice(0, 1), { ...B.steps[1]!, note: md`${B.steps[1]!.note} The $x$'s don't cancel, so this is an ordinary inequality.` }, ...B.steps.slice(2)],
  };
};

// ── Lesson 3 practice ───────────────────────────────────────────────────────

const threePart: Generator = (r) => {
  const L = r.int(-8, 4);
  const H = L + r.int(2, 8);
  const op1: Op = r.pick(["<", "<="]);
  const op2: Op = r.pick(["<", "<="]);
  const a = r.next() < 0.15 ? r.pick([1, -1]) : r.coef(-5, 5);
  const b = r.nonzero(-9, 9);
  const answer = `${L} ${op1} x ${op2} ${H}`;
  const box = { math: boxTex(L, op1, op2, H), note: "In interval notation." };
  if (a > 0) {
    const steps: Step[] = [{ math: md`${a * L} ${TEX[op1]} ${poly([[a, "x"]])} ${TEX[op2]} ${a * H}`, note: shiftNote(b, "in all three parts") }];
    if (a !== 1) steps.push({ math: md`${L} ${TEX[op1]} x ${TEX[op2]} ${H}`, note: md`Divide all three parts by ${a}. It's positive, so neither sign flips.` });
    return {
      prompt: md`Solve $${a * L + b} ${TEX[op1]} ${poly([[a, "x"], [b, ""]])} ${TEX[op2]} ${a * H + b}$. ${EITHER}`,
      answer,
      form: "inequality",
      hint: "Whatever you do to the middle, do to all three parts.",
      solution: [...steps, box],
    };
  }
  const mid = r.next() < 0.5 ? md`${b} - ${a === -1 ? "" : -a}x` : poly([[a, "x"], [b, ""]]);
  return {
    prompt: md`Solve $${a * H + b} ${TEX[op2]} ${mid} ${TEX[op1]} ${a * L + b}$. ${EITHER}`,
    answer,
    form: "inequality",
    hint: "Do each step to all three parts. When you divide by a negative, both signs flip.",
    solution: [
      { math: md`${a * H} ${TEX[op2]} ${poly([[a, "x"]])} ${TEX[op1]} ${a * L}`, note: shiftNote(b, "in all three parts") },
      { math: md`${H} ${TEX[FLIP[op2]]} x ${TEX[FLIP[op1]]} ${L}`, note: md`Divide all three parts by $${a}$. It's negative, so **both** signs flip.` },
      { math: md`${L} ${TEX[op1]} x ${TEX[op2]} ${H}`, note: "Rewrite it with the smaller number on the left. Same statement, read from the other end." },
      box,
    ],
  };
};

const orCompound: Generator = (r) => {
  const kind = r.int(0, 4);
  const p = r.int(-8, 2);
  const q = p + r.int(1, 7);
  let lowOp: Op, highOp: Op, lowN: number, highN: number;
  let answer: string | undefined;
  let combine: Step[];
  if (kind <= 2) {
    lowOp = r.pick(["<", "<="]);
    highOp = r.pick([">", ">="]);
    [lowN, highN] = [p, q];
    answer = `x ${lowOp} ${p} or x ${highOp} ${q}`;
    combine = [
      { math: md`x ${TEX[lowOp]} ${p} ${OR} x ${TEX[highOp]} ${q}`, note: `With "or", a number in either piece works. The pieces don't meet, so keep both.` },
      { math: unionTex(lowOp, p, highOp, q), note: "In interval notation." },
    ];
  } else if (kind === 3) {
    lowOp = r.pick(["<", "<="]);
    highOp = r.pick([">", ">="]);
    [lowN, highN] = [q, p];
    combine = [
      { math: md`x ${TEX[lowOp]} ${q} ${OR} x ${TEX[highOp]} ${p}`, note: md`The pieces overlap between ${p} and ${q}. Anything below ${q} is in the first; anything else is above ${p}, in the second.` },
      { math: md`\text{all real numbers}`, note: md`Together they cover the whole line: $(-\infty, \infty)$.` },
    ];
  } else {
    const dir = r.pick(["up", "down"] as const);
    const op1: Op = dir === "up" ? r.pick([">", ">="]) : r.pick(["<", "<="]);
    const op2: Op = dir === "up" ? r.pick([">", ">="]) : r.pick(["<", "<="]);
    [lowOp, highOp, lowN, highN] = [op1, op2, p, q];
    const [keepOp, keepN] = dir === "up" ? [op1, p] : [op2, q];
    answer = `x ${keepOp} ${keepN}`;
    combine = [
      {
        math: md`x ${TEX[keepOp]} ${keepN}`,
        note: md`Both pieces point the same way. Every number in the ${dir === "up" ? `piece above ${q}` : `piece below ${p}`} is already in the other piece, so the larger piece is the answer.`,
      },
      { math: rayTex(keepOp, keepN), note: "In interval notation." },
    ];
  }
  const A = linear(r, lowOp, lowN);
  const B = linear(r, highOp, highN);
  const [first, second] = r.next() < 0.5 ? [A, B] : [B, A];
  return {
    prompt: md`Find all $x$ with $${first.tex}$ **or** $${second.tex}$. ${EITHER} ${SPECIAL}`,
    ...(answer ? { answer } : { answer: ALL, accept: ALL_TEXT }),
    form: "inequality",
    hint: md`Solve each piece on its own. Then keep every number that is in **either** piece.`,
    solution: [...first.steps, ...second.steps, ...combine],
  };
};

const andCompound: Generator = (r) => {
  const kind = r.int(0, 3);
  const p = r.int(-8, 2);
  const q = p + r.int(1, 7);
  let ops: [Op, number][];
  let answer: string | undefined;
  let combine: Step[];
  if (kind <= 1) {
    const lo: Op = r.pick([">", ">="]);
    const hi: Op = r.pick(["<", "<="]);
    ops = [[lo, p], [hi, q]];
    answer = `${p} ${MIRROR[lo]} x ${hi} ${q}`;
    combine = [
      { math: md`${p} ${TEX[MIRROR[lo]]} x ${TEX[hi]} ${q}`, note: md`With "and", keep only the overlap: above ${p} and below ${q} at the same time.` },
      { math: boxTex(p, MIRROR[lo], hi, q), note: "In interval notation." },
    ];
  } else if (kind === 2) {
    const below: Op = r.pick(["<", "<="]);
    const above: Op = r.pick([">", ">="]);
    ops = [[below, p], [above, q]];
    combine = [{ math: md`\text{no solution}`, note: md`A number can't be below ${p} and above ${q} at once, since ${p} < ${q}. The pieces never overlap.` }];
  } else {
    const up = r.next() < 0.5;
    const op1: Op = up ? r.pick([">", ">="]) : r.pick(["<", "<="]);
    const op2: Op = up ? r.pick([">", ">="]) : r.pick(["<", "<="]);
    ops = [[op1, p], [op2, q]];
    const [keepOp, keepN] = up ? [op2, q] : [op1, p];
    answer = `x ${keepOp} ${keepN}`;
    combine = [
      { math: md`x ${TEX[keepOp]} ${keepN}`, note: md`Both point the same way. Only the numbers ${up ? `above ${q}` : `below ${p}`} pass both tests, so the overlap is the smaller piece.` },
      { math: rayTex(keepOp, keepN), note: "In interval notation." },
    ];
  }
  const [A, B] = ops.map(([op, n]) => linear(r, op, n)) as [ReturnType<typeof linear>, ReturnType<typeof linear>];
  const [first, second] = r.next() < 0.5 ? [A, B] : [B, A];
  return {
    prompt: md`Find all $x$ that satisfy both $${first.tex}$ **and** $${second.tex}$. ${EITHER} ${SPECIAL}`,
    ...(answer ? { answer } : { accept: NO_SOLUTION }),
    form: "inequality",
    hint: md`Solve each one, sketch both on a number line, and keep only where they **overlap**.`,
    solution: [...first.steps, ...second.steps, ...combine],
  };
};

/** "and" and "or" problems share one generator, half each. */
const twoPieceCompound: Generator = (r) => (r.next() < 0.5 ? orCompound(r) : andCompound(r));

// ── Lesson 4 practice ───────────────────────────────────────────────────────

const ABS_EQ = md`Give all solutions, separated by commas. If there are none, type **no solution**.`;

const absEquation: Generator = (r) => {
  const kind = r.int(0, 6);
  if (kind <= 1) {
    const m = r.nonzero(-8, 8);
    const rr = r.next() < 0.15 ? 0 : r.int(1, 9);
    const inner = poly([[1, "x"], [m, ""]]);
    if (rr === 0) {
      return {
        prompt: md`Solve $|${inner}| = 0$. ${ABS_EQ}`,
        answer: String(-m),
        form: "set",
        hint: "Which numbers are at distance 0 from 0?",
        solution: [
          { math: md`${inner} = 0`, note: "Only 0 is at distance 0 from 0, so there's just one case." },
          { math: md`x = ${-m}`, note: "One solution." },
        ],
      };
    }
    return {
      prompt: md`Solve $|${inner}| = ${rr}$. ${ABS_EQ}`,
      answer: `${-m + rr}, ${-m - rr}`,
      form: "set",
      hint: md`$|${inner}|$ is the distance from $x$ to $${-m}$. Which numbers are ${rr} away from $${-m}$?`,
      solution: [
        { math: md`${inner} = ${rr} ${OR} ${inner} = -${rr}`, note: md`The inside is ${rr} from 0, so it is ${rr} or $-${rr}$.` },
        { math: md`x = ${-m + rr} ${OR} x = ${-m - rr}`, note: shiftNote(m, "in each") },
      ],
    };
  }
  if (kind <= 3) {
    const { a, b, rr, s1, s2 } = absIntegerSetup(r);
    const inner = poly([[a, "x"], [b, ""]]);
    return {
      prompt: md`Solve $|${inner}| = ${rr}$. ${ABS_EQ}`,
      answer: `${s2}, ${s1}`,
      form: "set",
      hint: md`Split it into two equations: the inside equals ${rr}, or the inside equals $-${rr}$.`,
      solution: [
        { math: md`${inner} = ${rr} ${OR} ${inner} = -${rr}`, note: md`The inside is ${rr} from 0, so it is ${rr} or $-${rr}$.` },
        { math: md`${a}x = ${rr - b} ${OR} ${a}x = ${-rr - b}`, note: shiftNote(b, "in each") },
        { math: md`x = ${s2} ${OR} x = ${s1}`, note: md`Divide each by ${a}.` },
      ],
    };
  }
  const k = r.coef(2, 5);
  const m = r.nonzero(-8, 8);
  const n = r.nonzero(-9, 9);
  const inner = poly([[1, "x"], [m, ""]]);
  if (kind <= 5) {
    const rr = r.int(1, 7);
    const c = k * rr + n;
    return {
      prompt: md`Solve $${k}|${inner}| ${signed(n)} = ${c}$. ${ABS_EQ}`,
      answer: `${-m + rr}, ${-m - rr}`,
      form: "set",
      hint: md`Isolate the absolute value first, the way you'd isolate $x$. Then split.`,
      solution: [
        { math: md`${k}|${inner}| = ${k * rr}`, note: shiftNote(n) },
        { math: md`|${inner}| = ${rr}`, note: md`Divide both sides by ${k}.` },
        { math: md`${inner} = ${rr} ${OR} ${inner} = -${rr}`, note: "Split into two cases." },
        { math: md`x = ${-m + rr} ${OR} x = ${-m - rr}`, note: shiftNote(m, "in each") },
      ],
    };
  }
  const t = r.int(1, 6);
  if (r.next() < 0.5) {
    return {
      prompt: md`Solve $|${inner}| = -${t}$. ${ABS_EQ}`,
      accept: NO_SOLUTION,
      form: "set",
      hint: "Can a distance be negative?",
      solution: [
        { math: md`|${inner}| = -${t}`, note: "An absolute value is a distance, so it is never negative." },
        { math: md`\text{no solution}`, note: "" },
      ],
    };
  }
  const c = n - k * t;
  return {
    prompt: md`Solve $${k}|${inner}| ${signed(n)} = ${c}$. ${ABS_EQ}`,
    accept: NO_SOLUTION,
    form: "set",
    hint: "Isolate the absolute value first, then look at what it has to equal.",
    solution: [
      { math: md`${k}|${inner}| = ${-k * t}`, note: shiftNote(n) },
      { math: md`|${inner}| = -${t}`, note: md`Divide both sides by ${k}.` },
      { math: md`\text{no solution}`, note: "An absolute value is a distance, so it can't equal a negative number." },
    ],
  };
};

const absInequalityBasic: Generator = (r) => {
  const c = r.nonzero(-6, 6);
  const rr = r.int(1, 7);
  const op = r.pick(OPS);
  const inner = poly([[1, "x"], [-c, ""]]);
  const { answer, steps } = absSolve(1, -c, op, rr);
  const phrase = { "<": "less than", "<=": "at most", ">": "more than", ">=": "at least" }[op];
  return {
    prompt: md`Solve $|${inner}| ${TEX[op]} ${rr}$. ${EITHER}`,
    answer,
    form: "inequality",
    hint: md`$|${inner}|$ is the distance from $x$ to $${c}$. Which numbers are ${phrase} ${rr} away from $${c}$?`,
    solution: steps,
  };
};

const absInequality: Generator = (r) => {
  const kind = r.int(0, 5);
  if (kind <= 2) {
    const { a, b, rr } = absIntegerSetup(r);
    const op = r.pick(OPS);
    const { answer, steps } = absSolve(a, b, op, rr);
    return {
      prompt: md`Solve $|${poly([[a, "x"], [b, ""]])}| ${TEX[op]} ${rr}$. ${EITHER} ${SPECIAL}`,
      answer,
      form: "inequality",
      hint: isLess(op) ? md`"Less" means close to 0: write it as a three-part inequality.` : md`"Greater" means far from 0: split it into two pieces joined by "or".`,
      solution: steps,
    };
  }
  const m = r.nonzero(-6, 6);
  const inner = poly([[1, "x"], [m, ""]]);
  const n = r.nonzero(-9, 9);
  if (kind <= 4) {
    const k = r.pick([2, 3, 4, -2, -3]);
    const rr = r.int(1, 6);
    const final = r.pick(OPS);
    const op = k > 0 ? final : FLIP[final];
    const { answer, steps } = absSolve(1, m, final, rr);
    return {
      prompt: md`Solve $${k}|${inner}| ${signed(n)} ${TEX[op]} ${k * rr + n}$. ${EITHER} ${SPECIAL}`,
      answer,
      form: "inequality",
      hint: md`Isolate the absolute value first.${k < 0 ? " You'll divide by a negative number." : ""}`,
      solution: [
        { math: md`${k}|${inner}| ${TEX[op]} ${k * rr}`, note: md`${shiftNote(n)} The sign stays.` },
        {
          math: md`|${inner}| ${TEX[final]} ${rr}`,
          note: k > 0 ? md`Divide by ${k}, positive: no flip.` : md`Divide by $${k}$. It's negative, so the sign flips.`,
        },
        ...steps,
      ],
    };
  }
  const op = r.pick(OPS);
  const zero = r.next() < 0.25;
  const t = zero ? 0 : r.int(1, 6);
  const useOp: Op = zero ? (isLess(op) ? "<" : ">=") : op;
  const yes = isLess(useOp) ? false : true;
  const isolate = !zero && r.next() < 0.5;
  const k = r.coef(2, 4);
  const rhs = zero ? "0" : `-${t}`;
  const prompt = isolate ? md`${k}|${inner}| ${signed(n)} ${TEX[useOp]} ${n - k * t}` : md`|${inner}| ${TEX[useOp]} ${rhs}`;
  const steps: Step[] = isolate
    ? [
        { math: md`${k}|${inner}| ${TEX[useOp]} ${-k * t}`, note: shiftNote(n) },
        { math: md`|${inner}| ${TEX[useOp]} -${t}`, note: md`Divide by ${k}, positive: no flip.` },
      ]
    : [];
  const reason = yes
    ? zero
      ? md`A distance is always at least 0, so this is true for every $x$.`
      : md`A distance is never negative, so it is always bigger than $${rhs}$. This is true for every $x$.`
    : zero
      ? "A distance is never below 0, so this is never true."
      : `A distance can't be ${useOp === "<" ? "less than" : "at most"} a negative number. This is never true.`;
  steps.push(
    yes
      ? { math: md`\text{all real numbers}`, note: md`${reason} In interval notation, $(-\infty, \infty)$.` }
      : { math: md`\text{no solution}`, note: reason },
  );
  return {
    prompt: md`Solve $${prompt}$. ${EITHER} ${SPECIAL}`,
    ...(yes ? { answer: ALL, accept: ALL_TEXT } : { accept: NO_SOLUTION }),
    form: "inequality",
    hint: isolate ? "Isolate the absolute value first, then look at the number on the other side." : "An absolute value is a distance. Look at the number on the other side.",
    solution: steps,
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit3: Unit = {
  title: "Linear Inequalities",
  lessons: [
    {
      id: "inequalities-and-the-number-line",
      title: "Inequalities and the number line",
      summary: "What less than means, graphing solution sets, and interval notation.",
      blocks: [
        {
          kind: "text",
          body: md`An equation claims two things are equal. An **inequality** claims one is bigger than the other. There are four symbols:

- $a < b$: $a$ is **less than** $b$
- $a > b$: $a$ is **greater than** $b$
- $a \le b$: $a$ is less than **or equal to** $b$
- $a \ge b$: $a$ is greater than or equal to $b$

The narrow point aims at the smaller number. $3 < 7$ and $7 > 3$ say the same thing.`,
        },
        {
          kind: "why",
          title: "What does \"less than\" really mean?",
          body: md`On the number line, numbers increase as you go right. So $a < b$ means $a$ sits to the **left** of $b$.

That settles negative numbers. $-5 < -2$, because $-5$ is further left, even though 5 is bigger than 2.

There's an equivalent test that needs no picture: $a < b$ exactly when $b - a$ is **positive**. You have to add a positive amount to $a$ to reach $b$. For example $-2 - (-5) = 3$, which is positive, so $-5 < -2$. Keep this test in mind: it explains every rule in the next lesson.`,
        },
        {
          kind: "check",
          prompt: md`Which is larger, $-\frac{1}{2}$ or $-\frac{1}{3}$?`,
          answer: "-1/3",
          explain: md`$-\frac{1}{3} - \left(-\frac{1}{2}\right) = \frac{1}{6}$, which is positive, so $-\frac{1}{3}$ is larger. On the line, $-\frac{1}{3}$ is closer to 0, so it is further right.`,
        },
        {
          kind: "text",
          body: md`An inequality with a variable, like $x > 2$, has a **solution set**: all the values that make it true. Here that's 3, 2.5, 2.001, 1000, and infinitely many more. Too many to list, so we draw them instead.`,
        },
        {
          kind: "numberline",
          range: [-4, 6],
          intervals: [{ from: 2, to: null, fromOpen: true }],
          caption: md`$x > 2$: an open circle at 2, shaded to the right forever.`,
        },
        {
          kind: "numberline",
          range: [-6, 4],
          intervals: [{ from: null, to: -1 }],
          caption: md`$x \le -1$: a filled circle at $-1$, shaded to the left.`,
        },
        {
          kind: "why",
          title: "Why an open circle?",
          body: md`2 itself is not a solution of $x > 2$, because $2 > 2$ is false. But numbers just above 2 are: 2.1, 2.01, 2.001.

There is no *smallest* number above 2. Name any one, and the number halfway between it and 2 is smaller and still works. So the shading must start right at 2 without including it. The hollow circle means "up to here, but not this point".

For $x \ge 2$, the point 2 does count, so the circle is filled in.`,
        },
        {
          kind: "key",
          title: "Interval notation",
          body: md`A shorter way to write a solution set: the left end, a comma, then the right end.

- A **parenthesis** ( or ) means the endpoint is left out (open circle).
- A **bracket** [ or ] means the endpoint is included (filled circle).
- $\infty$ (**infinity**) means the shading never stops. $-\infty$ is the same to the left.

So $x > 2$ is $(2, \infty)$, and $x \le -1$ is $(-\infty, -1]$. To type $\infty$, write **inf**, as in (-inf, -1].`,
        },
        {
          kind: "why",
          title: "Why is there always a parenthesis next to infinity?",
          body: md`$\infty$ is not a number. It's shorthand for "keeps going". No number equals infinity, so there's no endpoint there to include. $(-\infty, -1]$ is right; $[-\infty, -1]$ is not.`,
        },
        {
          kind: "example",
          title: "From words to symbols",
          problem: md`Write "a number is at least $-3$" as an inequality and in interval notation.`,
          steps: [
            { math: md`x \ge -3`, note: md`**At least** $-3$ means $-3$ or more. $-3$ itself counts, so use $\ge$.` },
            { math: md`[-3, \infty)`, note: md`A bracket at $-3$ because it's included. A parenthesis at infinity, always.` },
            { math: md`-3 \le x`, note: md`The same set, written from the other side. Both point at the smaller number, $-3$.` },
          ],
        },
        {
          kind: "example",
          title: "Reading a graph",
          problem: md`A number line has an open circle at 4 and is shaded to the left. Write the set.`,
          steps: [
            { math: md`x < 4`, note: "Shaded left means smaller numbers. The open circle means 4 is left out." },
            { math: md`(-\infty, 4)`, note: "In interval notation." },
          ],
        },
        {
          kind: "text",
          body: md`Phrases you'll meet in word problems:

- "more than", "greater than", "exceeds": $>$
- "less than", "below", "fewer than": $<$
- "at least", "no less than", "a minimum of": $\ge$
- "at most", "no more than", "a maximum of": $\le$`,
        },
        {
          kind: "check",
          prompt: md`Write **$x$ is no more than 5**. ${EITHER}`,
          form: "inequality",
          answer: "x <= 5",
          explain: md`"No more than 5" means 5 or less: $x \le 5$, or $(-\infty, 5]$.`,
        },
        {
          kind: "check",
          prompt: md`What is the smallest integer that satisfies $x > -4$?`,
          answer: "-3",
          explain: md`$-4$ is left out (open circle). The next integer to the right is $-3$.`,
        },
      ],
      practice: [wordsToInequality, readingSolutionSets],
    },
    {
      id: "solving-inequalities-and-why-the-sign-flips",
      title: "Solving inequalities (and why the sign flips)",
      summary: "Which moves keep an inequality true, and why multiplying by a negative reverses it.",
      blocks: [
        {
          kind: "text",
          body: md`Solving $3x - 4 < 11$ works almost like solving an equation: undo what was done to $x$. But each move has to keep the solution set the same. For equations, "do the same thing to both sides" was enough. For inequalities it isn't quite. Test some moves on the true statement $2 < 5$:

- Add 3: $5 < 8$. Still true.
- Subtract 10: $-8 < -5$. Still true.
- Multiply by 4: $8 < 20$. Still true.
- Multiply by $-1$: $-2 < -5$? **False.** $-2$ is to the right of $-5$.

The first three are safe. The last one breaks. Here's why.`,
        },
        {
          kind: "why",
          title: "Adding keeps the order",
          body: md`Recall: $a < b$ means $b - a$ is positive. Add $c$ to both:

$$(b + c) - (a + c) = b - a.$$

The gap hasn't changed, so it is still positive, and $a + c < b + c$. On the number line, adding $c$ slides both points the same distance. The one on the left stays on the left. Subtracting $c$ is adding $-c$, so it's covered too.`,
        },
        {
          kind: "why",
          title: "Multiplying by a positive keeps the order",
          body: md`Suppose $b - a$ is positive and $c$ is positive. Then

$$cb - ca = c(b - a)$$

is a positive times a positive, which is positive. So $ca < cb$. Picture it as stretching the number line away from 0: points spread out but keep their left-to-right order. Dividing by a positive $c$ is multiplying by $\frac{1}{c}$, which is also positive.`,
        },
        {
          kind: "why",
          title: "Multiplying by a negative flips it",
          body: md`Now let $c$ be negative. Then $cb - ca = c(b - a)$ is a negative times a positive, which is **negative**. So $cb < ca$: the order has reversed.

Geometrically, multiplying by $-1$ reflects every point across 0. Whatever was on the left lands on the right. So from $2 < 5$ we get $-2 > -5$. Multiplying by any other negative number is a reflection plus a stretch or shrink, and stretching doesn't undo the reversal.`,
        },
        {
          kind: "numberline",
          range: [-6, 6],
          points: [{ at: -5 }, { at: -2 }, { at: 2 }, { at: 5 }],
          caption: md`Reflecting across 0 sends 2 to $-2$ and 5 to $-5$. Before, 2 was on the left. After, its image $-2$ is on the right: $2 < 5$ becomes $-2 > -5$.`,
        },
        {
          kind: "key",
          title: "Rules for solving inequalities",
          body: md`- Add or subtract any number on both sides: the sign stays.
- Multiply or divide both sides by a **positive** number: the sign stays.
- Multiply or divide both sides by a **negative** number: **flip** the sign. $<$ becomes $>$, $\le$ becomes $\ge$, and the other way round.
- Swapping the two sides also flips how it reads: $5 > x$ means the same as $x < 5$.`,
        },
        {
          kind: "example",
          title: "Two steps, no flip",
          problem: md`Solve $3x - 4 < 11$.`,
          steps: [
            { math: md`3x < 15`, note: "Add 4 to both sides. Adding never changes the direction." },
            { math: md`x < 5`, note: "Divide by 3. It's positive, so no flip." },
            { math: md`(-\infty, 5)`, note: "In interval notation." },
          ],
        },
        {
          kind: "example",
          title: "A negative coefficient",
          problem: md`Solve $7 - 2x \ge 13$.`,
          steps: [
            { math: md`-2x \ge 6`, note: "Subtract 7 from both sides." },
            { math: md`x \le -3`, note: md`Divide by $-2$. Dividing by a negative reverses the order, so $\ge$ becomes $\le$.` },
            { math: md`x = -4:\quad 7 - 2(-4) = 15 \ge 13 \;\checkmark`, note: "Test a number inside the answer. It works." },
            { math: md`x = 0:\quad 7 - 2(0) = 7 \ge 13 \text{ is false}`, note: "Test a number outside. It fails, as it should." },
          ],
        },
        {
          kind: "numberline",
          range: [-8, 2],
          intervals: [{ from: null, to: -3 }],
          caption: md`$x \le -3$, or $(-\infty, -3]$.`,
        },
        {
          kind: "why",
          title: "A second route to the same answer",
          body: md`You can avoid the flip entirely. In $7 - 2x \ge 13$, add $2x$ to both sides and subtract 13:

$$-6 \ge 2x.$$

Now divide by 2, a positive number: $-3 \ge x$. That says $x$ is at most $-3$, which is $x \le -3$. Same answer. The flip rule is just a shortcut for this, which is good evidence that it's right.`,
        },
        {
          kind: "example",
          title: "Variables on both sides",
          problem: md`Solve $2(x - 1) \ge 5x + 4$.`,
          steps: [
            { math: md`2x - 2 \ge 5x + 4`, note: "Distribute." },
            { math: md`-3x - 2 \ge 4`, note: md`Subtract $5x$ from both sides.` },
            { math: md`-3x \ge 6`, note: "Add 2." },
            { math: md`x \le -2`, note: md`Divide by $-3$: flip.` },
          ],
        },
        {
          kind: "text",
          body: md`Sometimes the $x$'s cancel, just as with equations. $2x + 1 < 2x + 5$ becomes $1 < 5$, which is true whatever $x$ is: **all real numbers**, $(-\infty, \infty)$. And $2x + 5 < 2x + 1$ becomes $5 < 1$, which is never true: **no solution**.`,
        },
        {
          kind: "check",
          prompt: md`Solve $-4x < 12$. ${EITHER}`,
          form: "inequality",
          answer: "x > -3",
          explain: md`Divide by $-4$ and flip: $x > -3$. Check $x = 0$: $0 < 12$ ✓.`,
        },
        {
          kind: "check",
          prompt: md`Solve $5 - x \le 2x - 7$. ${EITHER}`,
          form: "inequality",
          answer: "x >= 4",
          explain: md`Add $x$ and add 7: $12 \le 3x$. Divide by 3: $4 \le x$, which is $x \ge 4$.`,
        },
      ],
      practice: [oneStepInequality, multiStepInequality, specialInequality],
    },
    {
      id: "compound-inequalities",
      title: "Compound inequalities",
      summary: "Joining two conditions with and or or, and solving three-part inequalities.",
      blocks: [
        {
          kind: "text",
          body: md`A **compound inequality** joins two inequalities with "and" or "or".

- **And**: both must be true. For example, $x > -2$ and $x \le 4$.
- **Or**: at least one must be true. For example, $x < -1$ or $x \ge 3$.`,
        },
        {
          kind: "why",
          title: "Why \"and\" is the overlap and \"or\" is the combination",
          body: md`A number solves "A and B" only if it passes **both** tests. On the number line it has to lie in A's shading and in B's shading at the same time: the stretch where they overlap.

For "A or B", passing either test is enough. So every point shaded by A, by B, or by both, counts: you put the two pictures together.`,
        },
        {
          kind: "numberline",
          range: [-5, 6],
          intervals: [{ from: -2, to: 4, fromOpen: true }],
          caption: md`$x > -2$ and $x \le 4$: the overlap is the stretch between them.`,
        },
        {
          kind: "key",
          title: "The three-part form",
          body: md`$-2 < x \le 4$ is short for $-2 < x$ **and** $x \le 4$. Read it as "$x$ is between $-2$ and 4, including 4".

In interval notation it's $(-2, 4]$, smaller end first. Use the three-part form only for an "and" whose answer is one stretch, with both signs pointing the same way.`,
        },
        {
          kind: "numberline",
          range: [-5, 6],
          intervals: [
            { from: null, to: -1, toOpen: true },
            { from: 3, to: null },
          ],
          caption: md`$x < -1$ or $x \ge 3$: two separate pieces. In interval notation, join them with $\cup$ (**union**): $(-\infty, -1) \cup [3, \infty)$. To type $\cup$, use a capital U with a space on each side, as in (-inf, -1) U [3, inf), or just write **or**.`,
        },
        {
          kind: "why",
          title: "Why you can work on all three parts at once",
          body: md`$-3 \le 2x + 1 < 7$ is really two inequalities: $-3 \le 2x + 1$ and $2x + 1 < 7$. Solving each one takes the same steps: subtract 1, then divide by 2. So do each step to all three parts together, and you solve both at once.

If a step divides by a negative, **both** signs flip, because each of the two inequalities flips.`,
        },
        {
          kind: "example",
          title: "A three-part inequality",
          problem: md`Solve $-3 \le 2x + 1 < 7$.`,
          steps: [
            { math: md`-4 \le 2x < 6`, note: "Subtract 1 from all three parts." },
            { math: md`-2 \le x < 3`, note: "Divide all three parts by 2. Positive, so no flips." },
            { math: md`[-2, 3)`, note: "In interval notation." },
          ],
        },
        {
          kind: "example",
          title: "Dividing by a negative",
          problem: md`Solve $1 < 5 - 2x \le 9$.`,
          steps: [
            { math: md`-4 < -2x \le 4`, note: "Subtract 5 from all three parts." },
            { math: md`2 > x \ge -2`, note: md`Divide all three parts by $-2$. Both signs flip.` },
            { math: md`-2 \le x < 2`, note: "Rewrite with the smaller number on the left, so it reads like the number line. Same set." },
          ],
        },
        {
          kind: "example",
          title: "An \"or\" problem",
          problem: md`Solve $3x - 1 < -7$ or $2x + 3 \ge 9$.`,
          steps: [
            { math: md`3x < -6 \;\Rightarrow\; x < -2`, note: "Solve the first piece." },
            { math: md`2x \ge 6 \;\Rightarrow\; x \ge 3`, note: "Solve the second piece." },
            { math: md`x < -2 ${OR} x \ge 3`, note: `With "or", any number in either piece works. The pieces don't meet, so keep both.` },
            { math: md`(-\infty, -2) \cup [3, \infty)`, note: "In interval notation." },
          ],
        },
        {
          kind: "text",
          body: md`Sketch the pieces and these cases sort themselves out:

- $x < 1$ **and** $x > 4$: nothing is below 1 and above 4 at once. **No solution.**
- $x < 4$ **or** $x > 1$: every number is below 4 or above 1 (or both). **All real numbers.**
- $x > 2$ **and** $x > 5$: the overlap is just $x > 5$.
- $x > 2$ **or** $x > 5$: together they make $x > 2$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $-5 < 3x + 1 \le 10$. ${EITHER}`,
          form: "inequality",
          answer: "-2 < x <= 3",
          explain: md`Subtract 1: $-6 < 3x \le 9$. Divide by 3: $-2 < x \le 3$, or $(-2, 3]$.`,
        },
        {
          kind: "check",
          prompt: md`Find all $x$ with $x + 4 < 2$ **or** $-3x < -9$. ${EITHER}`,
          form: "inequality",
          answer: "x < -2 or x > 3",
          explain: md`The first gives $x < -2$. The second: divide by $-3$ and flip, $x > 3$. So $x < -2$ or $x > 3$.`,
        },
      ],
      practice: [threePart, twoPieceCompound],
    },
    {
      id: "absolute-value-equations-and-inequalities",
      title: "Absolute value equations and inequalities",
      summary: "Absolute value as distance, and how it turns into two equations, an and, or an or.",
      blocks: [
        {
          kind: "text",
          body: md`The **absolute value** $|a|$ is the distance from $a$ to 0 on the number line: $|5| = 5$, $|-5| = 5$, and $|0| = 0$. A distance is never negative.`,
        },
        {
          kind: "why",
          title: md`Why $|x - c|$ is the distance from $x$ to $c$`,
          body: md`The distance between two numbers is the bigger minus the smaller: from 2 to 7 is $7 - 2 = 5$. Subtract in the other order and you get $-5$, the right size with the wrong sign. Absolute value fixes the sign either way: $|7 - 2| = |2 - 7| = 5$.

So $|x - c|$ is the distance between $x$ and $c$, whichever is bigger. For $|x + 3|$, write it as $|x - (-3)|$: the distance from $x$ to $-3$.`,
        },
        {
          kind: "numberline",
          range: [-4, 6],
          points: [{ at: -2 }, { at: 4 }],
          caption: md`$|x - 1| = 3$ asks which numbers are 3 units from 1. Walk 3 right to reach 4, or 3 left to reach $-2$. Exactly two answers.`,
        },
        {
          kind: "key",
          title: "Absolute value equations",
          body: md`For $r > 0$, $|A| = r$ means $A = r$ **or** $A = -r$. Solve both.

- If $r = 0$, there's one solution: $A = 0$.
- If $r < 0$, there's **no solution**, since a distance can't be negative.

Isolate the absolute value first, the same way you'd isolate $x$.`,
        },
        {
          kind: "example",
          title: "Splitting into two equations",
          problem: md`Solve $|2x - 3| = 7$.`,
          steps: [
            { math: md`2x - 3 = 7 ${OR} 2x - 3 = -7`, note: "The inside is 7 away from 0, so it is 7 or $-7$." },
            { math: md`2x = 10 ${OR} 2x = -4`, note: "Add 3 in each." },
            { math: md`x = 5 ${OR} x = -2`, note: "Divide each by 2." },
            { math: md`|2(5) - 3| = 7, \quad |2(-2) - 3| = |-7| = 7 \;\checkmark`, note: "Check both." },
          ],
        },
        {
          kind: "example",
          title: "Isolate first",
          problem: md`Solve $3|x + 2| - 4 = 11$.`,
          steps: [
            { math: md`3|x + 2| = 15`, note: "Add 4." },
            { math: md`|x + 2| = 5`, note: md`Divide by 3. Now the absolute value is alone.` },
            { math: md`x + 2 = 5 ${OR} x + 2 = -5`, note: "Split." },
            { math: md`x = 3 ${OR} x = -7`, note: "Subtract 2 in each." },
          ],
        },
        {
          kind: "why",
          title: "\"Less than\" means close, \"greater than\" means far",
          body: md`$|x - c| < r$ says $x$ is less than $r$ units from $c$. Those numbers fill the stretch from $c - r$ to $c + r$, with neither end included. That's one unbroken stretch, an **and**:

$$c - r < x < c + r.$$

$|x - c| > r$ says $x$ is more than $r$ units from $c$. That happens past either end: $x < c - r$ **or** $x > c + r$. Two separate pieces, an **or**.`,
        },
        {
          kind: "numberline",
          range: [-4, 6],
          intervals: [{ from: -2, to: 4, fromOpen: true, toOpen: true }],
          caption: md`$|x - 1| < 3$: within 3 of 1, so $-2 < x < 4$.`,
        },
        {
          kind: "numberline",
          range: [-4, 6],
          intervals: [
            { from: null, to: -2, toOpen: true },
            { from: 4, to: null, fromOpen: true },
          ],
          caption: md`$|x - 1| > 3$: more than 3 from 1, so $x < -2$ or $x > 4$.`,
        },
        {
          kind: "key",
          title: "Absolute value inequalities",
          body: md`For $r > 0$:

- $|A| < r$ becomes $-r < A < r$ (an **and**).
- $|A| > r$ becomes $A < -r$ **or** $A > r$.

The same goes for $\le$ and $\ge$, with the endpoints included. $A$ can be any expression: $|A|$ is the distance from $A$ to 0, which is the picture above with $c = 0$.`,
        },
        {
          kind: "example",
          title: "Less than: one stretch",
          problem: md`Solve $|2x + 1| \le 7$.`,
          steps: [
            { math: md`-7 \le 2x + 1 \le 7`, note: "The inside is at most 7 from 0, so it is between $-7$ and 7." },
            { math: md`-8 \le 2x \le 6`, note: "Subtract 1 from all three parts." },
            { math: md`-4 \le x \le 3`, note: "Divide all three parts by 2." },
            { math: md`[-4, 3]`, note: "In interval notation." },
          ],
        },
        {
          kind: "example",
          title: "Greater than: two pieces",
          problem: md`Solve $|x - 3| > 2$.`,
          steps: [
            { math: md`x - 3 < -2 ${OR} x - 3 > 2`, note: "The inside is more than 2 from 0, past either end." },
            { math: md`x < 1 ${OR} x > 5`, note: "Add 3 in each piece." },
            { math: md`(-\infty, 1) \cup (5, \infty)`, note: "In interval notation." },
          ],
        },
        {
          kind: "why",
          title: "When the other side is negative",
          body: md`$|A| < -2$ asks for a distance below $-2$. Distances are never negative, so there's **no solution**.

$|A| > -2$ is always true, since every distance is at least 0, and 0 is more than $-2$. The answer is **all real numbers**. Think about distance before reaching for the rules.`,
        },
        {
          kind: "check",
          prompt: md`Solve $|x + 1| = 4$. Give both solutions, separated by commas.`,
          form: "set",
          answer: "3, -5",
          explain: md`$x + 1 = 4$ or $x + 1 = -4$, so $x = 3$ or $x = -5$. Both are 4 units from $-1$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $|x - 2| < 5$. ${EITHER}`,
          form: "inequality",
          answer: "-3 < x < 7",
          explain: md`Within 5 of 2: $-5 < x - 2 < 5$, so $-3 < x < 7$, or $(-3, 7)$.`,
        },
      ],
      practice: [absEquation, absInequalityBasic, absInequality],
    },
  ],
};
