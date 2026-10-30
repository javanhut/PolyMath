import { gcd, paren, poly, signed } from "../../math/random";
import { md, type Generator, type Problem, type Step, type Unit } from "../types";
import { NO_SOLUTION } from "./unit2";

const INFINITELY_MANY = [
  "infinitely many",
  "infinitely many solutions",
  "infinite",
  "infinitely",
  "infinite solutions",
  "infinitely many pairs",
  "infinitely many points",
  "same line",
  "the same line",
];

const PAIR = md`Give the answer as an ordered pair $(x, y)$.`;
const SPECIAL = md`If there is no solution, type **no solution**. If there are infinitely many, type **infinitely many**.`;

// ── Helpers ─────────────────────────────────────────────────────────────────

type Var = "x" | "y";

/** The line a x + b y = c. */
interface Eq {
  a: number;
  b: number;
  c: number;
}

const eqTex = (e: Eq) => `${poly([[e.a, "x"], [e.b, "y"]])} = ${e.c}`;
const lhsTex = (e: Eq) => poly([[e.a, "x"], [e.b, "y"]]);
const through = (a: number, b: number, x: number, y: number): Eq => ({ a, b, c: a * x + b * y });
const scale = (e: Eq, f: number): Eq => ({ a: f * e.a, b: f * e.b, c: f * e.c });
const pair = (x: number, y: number) => `(${x}, ${y})`;
const tail = (n: number) => (n === 0 ? "" : ` ${signed(n)}`);
const otherVar = (v: Var): Var => (v === "x" ? "y" : "x");
/** An equation with coefficient vc on variable v and oc on the other one, through (x0, y0). */
const mk = (v: Var, vc: number, oc: number, x0: number, y0: number): Eq => (v === "x" ? through(vc, oc, x0, y0) : through(oc, vc, x0, y0));

/** One term of a substitution like "2(3)" or "- (-1)". */
function product(c: number, v: number, first: boolean): string {
  const m = Math.abs(c);
  const body = m === 1 ? (first && c > 0 ? String(v) : paren(v)) : `${m}(${v})`;
  if (first) return c < 0 ? `-${body}` : body;
  return `${c < 0 ? "-" : "+"} ${body}`;
}

/** "2(3) - 4(-1)": coefficients times substituted values, for checks. */
const evalTex = (terms: [number, number][]) => terms.map(([c, v], i) => product(c, v, i === 0)).join(" ");

/** A coefficient times a parenthesised expression: "3(2x - 1)", "- (y + 4)". */
function group(c: number, inner: string, first: boolean): string {
  const m = Math.abs(c);
  const body = `${m === 1 ? "" : m}(${inner})`;
  if (first) return c < 0 ? `-${body}` : body;
  return `${c < 0 ? "-" : "+"} ${body}`;
}

/** A variable term in the middle of a sum: "+ 3y", "- y". */
const term = (c: number, v: string) => `${c < 0 ? "-" : "+"} ${poly([[Math.abs(c), v]])}`;

const checkIn = (e: Eq, x: number, y: number) => md`$${evalTex([[e.a, x], [e.b, y]])} = ${e.c} \;\checkmark$`;

/** The last division, skipped when the coefficient is already 1. */
function solveFor(coef: number, v: string, value: number): Step[] {
  return coef === 1 ? [] : [{ math: `${v} = ${value}`, note: md`Divide both sides by ${coef}.` }];
}

/** Put a known value of the other variable into e and solve for v. */
function backSub(e: Eq, v: Var, known: number, value: number, where: string): Step[] {
  const o = otherVar(v);
  const vc = v === "x" ? e.a : e.b;
  const oc = v === "x" ? e.b : e.a;
  const sub = v === "x" ? `${poly([[vc, "x"]])} ${product(oc, known, false)}` : `${product(oc, known, true)} ${term(vc, "y")}`;
  const k = oc * known;
  return [
    { math: `${sub} = ${e.c}`, note: md`Put $${o} = ${known}$ into ${where}.` },
    { math: `${poly([[vc, v]])} = ${e.c - k}`, note: k === 0 ? "Simplify." : md`${k > 0 ? "Subtract" : "Add"} ${Math.abs(k)} on both sides.` },
    ...solveFor(vc, v, value),
  ];
}

/** y = m x + k written as a standard-form equation, scaled by s. */
const lineEq = (m: number, k: number, s: number): Eq => ({ a: -m * s, b: s, c: k * s });

/** Steps that turn a x + b y = c into y = m x + k. */
function toSlope(e: Eq, which: string): Step[] {
  const m = -e.a / e.b;
  const k = e.c / e.b;
  const steps: Step[] = [
    { math: `${poly([[e.b, "y"]])} = ${poly([[-e.a, "x"], [e.c, ""]])}`, note: md`${which}: ${e.a > 0 ? "subtract" : "add"} $${poly([[Math.abs(e.a), "x"]])}$ on both sides.` },
  ];
  if (e.b !== 1) steps.push({ math: `y = ${poly([[m, "x"], [k, ""]])}`, note: md`Divide every term by ${e.b}. Slope ${m}, $y$-intercept ${k}.` });
  else steps[0]!.note += md` Slope ${m}, $y$-intercept ${k}.`;
  return steps;
}

/** A standard-form scale that makes the x-coefficient positive. */
const scaleFor = (m: number, size: number) => (m > 0 ? -size : size);

/**
 * Substitute iso = m·o + k into e (a x + b y = c), solve, and back-substitute.
 * Returns every step after the isolated equation is known.
 */
function substituteSteps(iso: Var, m: number, k: number, e: Eq, x0: number, y0: number): Step[] {
  const o = otherVar(iso);
  const [i0, o0] = iso === "y" ? [y0, x0] : [x0, y0];
  const p = iso === "y" ? e.b : e.a;
  const q = iso === "y" ? e.a : e.b;
  const inner = poly([[m, o], [k, ""]]);
  const replaced = iso === "y" ? `${poly([[e.a, "x"]])} ${group(e.b, inner, false)}` : `${group(e.a, inner, true)} ${term(e.b, "y")}`;
  const distributed = iso === "y" ? poly([[e.a, "x"], [e.b * m, "x"], [e.b * k, ""]]) : poly([[e.a * m, "y"], [e.a * k, ""], [e.b, "y"]]);
  const coef = p * m + q;
  const steps: Step[] = [
    { math: `${replaced} = ${e.c}`, note: md`Replace $${iso}$ with $${inner}$ in the other equation. They are equal, so this is allowed. Keep the parentheses.` },
    { math: `${distributed} = ${e.c}`, note: "Distribute." },
    { math: `${poly([[coef, o], [p * k, ""]])} = ${e.c}`, note: md`Combine like terms. Only $${o}$ is left: a Unit 2 equation.` },
  ];
  if (p * k !== 0) steps.push({ math: `${poly([[coef, o]])} = ${e.c - p * k}`, note: md`${p * k > 0 ? "Subtract" : "Add"} ${Math.abs(p * k)} on both sides.` });
  steps.push(...solveFor(coef, o, o0));
  const middle = `${evalTex([[m, o0]])}${tail(k)}`;
  steps.push({ math: middle === String(i0) ? `${iso} = ${i0}` : `${iso} = ${middle} = ${i0}`, note: md`Put $${o} = ${o0}$ back into $${iso} = ${inner}$.` });
  steps.push({ math: pair(x0, y0), note: md`Check in the other equation: ${checkIn(e, x0, y0)}.` });
  return steps;
}

// ── Practice: solving by graphing ───────────────────────────────────────────

const isSolution: Generator = (r) => {
  const x0 = r.int(-4, 4);
  const y0 = r.int(-4, 4);
  let e1: Eq;
  let e2: Eq;
  do {
    e1 = through(r.nonzero(-4, 4), r.nonzero(-4, 4), x0, y0);
    e2 = through(r.nonzero(-4, 4), r.nonzero(-4, 4), x0, y0);
  } while (e1.a * e2.b === e1.b * e2.a);
  const kind = r.pick(["both", "both", "first", "second", "neither"] as const);
  let [px, py] = [x0, y0];
  if (kind === "first") [px, py] = [x0 + e1.b, y0 - e1.a];
  if (kind === "second") [px, py] = [x0 + e2.b, y0 - e2.a];
  if (kind === "neither") px = x0 + r.sign();
  const v1 = e1.a * px + e1.b * py;
  const v2 = e2.a * px + e2.b * py;
  const ok1 = v1 === e1.c;
  const ok2 = v2 === e2.c;
  const line = (v: number, e: Eq, ok: boolean, which: string) => ({
    math: `${evalTex([[e.a, px], [e.b, py]])} = ${v}`,
    note: ok ? md`${which} equation: $${v} = ${e.c}$, true.` : md`${which} equation: $${v} \ne ${e.c}$, false.`,
  });
  return {
    prompt: md`Is $${pair(px, py)}$ a solution of the system $${eqTex(e1)}$ and $${eqTex(e2)}$? Type **yes** or **no**.`,
    accept: ok1 && ok2 ? ["yes"] : ["no"],
    hint: md`Put $x = ${px}$ and $y = ${py}$ into **each** equation. A solution of the system has to make both true.`,
    solution: [
      line(v1, e1, ok1, "First"),
      line(v2, e2, ok2, "Second"),
      {
        math: ok1 && ok2 ? md`\text{yes}` : md`\text{no}`,
        note: ok1 && ok2 ? "Both are true, so the point lies on both lines." : ok1 || ok2 ? "It works in only one equation: the point is on one line but not the other." : "It works in neither equation.",
      },
    ],
  };
};

const graphSlopeIntercept: Generator = (r): Problem => {
  for (;;) {
    const x0 = r.int(-4, 4);
    const y0 = r.int(-5, 5);
    const m1 = r.nonzero(-3, 3);
    const m2 = r.nonzero(-3, 3);
    if (m1 === m2) continue;
    const k1 = y0 - m1 * x0;
    const k2 = y0 - m2 * x0;
    if (Math.abs(k1) > 8 || Math.abs(k2) > 8) continue;
    const describe = (m: number, k: number, which: string): Step => ({
      math: `y = ${poly([[m, "x"], [k, ""]])}`,
      note: md`${which} line: start at $(0, ${k})$ on the $y$-axis. The slope is ${m}, so each step right goes ${m > 0 ? "up" : "down"} ${Math.abs(m)}.`,
    });
    return {
      prompt: md`Solve the system $y = ${poly([[m1, "x"], [k1, ""]])}$ and $y = ${poly([[m2, "x"], [k2, ""]])}$ by graphing. ${PAIR}`,
      answer: pair(x0, y0),
      form: "tuple",
      hint: md`Graph each line: start at its $y$-intercept, then use the slope as rise over run. Read off where the lines cross, then check the point in both equations.`,
      solution: [
        describe(m1, k1, "First"),
        describe(m2, k2, "Second"),
        {
          math: md`x = ${x0}: \quad ${evalTex([[m1, x0]])}${tail(k1)} = ${y0}, \quad ${evalTex([[m2, x0]])}${tail(k2)} = ${y0}`,
          note: "At this x both lines are at the same height, so this is where they cross.",
        },
        { math: pair(x0, y0), note: "The crossing point is on both lines, so it makes both equations true." },
      ],
    };
  }
};

const graphStandardForm: Generator = (r): Problem => {
  const kind = r.pick(["one", "one", "one", "none", "many"] as const);
  const prompt = (e1: Eq, e2: Eq) => md`Solve the system $${eqTex(e1)}$ and $${eqTex(e2)}$. ${PAIR} ${SPECIAL}`;
  const hint = md`Rewrite each equation in slope-intercept form. Compare the slopes and the intercepts before you graph.`;
  if (kind === "one") {
    for (;;) {
      const x0 = r.int(-4, 4);
      const y0 = r.int(-5, 5);
      const m1 = r.nonzero(-3, 3);
      const m2 = r.nonzero(-3, 3);
      if (m1 === m2) continue;
      const k1 = y0 - m1 * x0;
      const k2 = y0 - m2 * x0;
      if (Math.abs(k1) > 7 || Math.abs(k2) > 7) continue;
      const e1 = lineEq(m1, k1, scaleFor(m1, r.pick([1, 1, 2])));
      const e2 = lineEq(m2, k2, scaleFor(m2, r.pick([1, 1, 2])));
      return {
        prompt: prompt(e1, e2),
        answer: pair(x0, y0),
        form: "tuple",
        accept: undefined,
        hint,
        solution: [
          ...toSlope(e1, "First equation"),
          ...toSlope(e2, "Second equation"),
          { math: md`${m1} \ne ${m2}`, note: "The slopes are different, so the lines cross exactly once." },
          {
            math: md`x = ${x0}: \quad ${evalTex([[m1, x0]])}${tail(k1)} = ${y0}, \quad ${evalTex([[m2, x0]])}${tail(k2)} = ${y0}`,
            note: "Graph both lines and follow them to the crossing: at this x they are at the same height.",
          },
          { math: pair(x0, y0), note: md`Check in the original first equation: ${checkIn(e1, x0, y0)}.` },
        ],
      };
    }
  }
  const m = r.nonzero(-3, 3);
  const k1 = r.int(-6, 6);
  if (kind === "none") {
    let k2 = r.int(-6, 6);
    while (k2 === k1) k2 = r.int(-6, 6);
    const e1 = lineEq(m, k1, scaleFor(m, r.pick([1, 2])));
    const e2 = lineEq(m, k2, scaleFor(m, r.pick([1, 2])));
    return {
      prompt: prompt(e1, e2),
      accept: NO_SOLUTION,
      hint,
      solution: [
        ...toSlope(e1, "First equation"),
        ...toSlope(e2, "Second equation"),
        { math: md`\text{same slope, different } y\text{-intercepts}`, note: "The lines are parallel: they keep the same gap forever and never meet." },
        { math: md`\text{no solution}`, note: "No point is on both lines, so no pair makes both equations true." },
      ],
    };
  }
  const s1 = scaleFor(m, r.pick([1, 2]));
  const e1 = lineEq(m, k1, s1);
  const e2 = lineEq(m, k1, s1 * r.pick([2, 3, -1]));
  return {
    prompt: prompt(e1, e2),
    accept: INFINITELY_MANY,
    hint,
    solution: [
      ...toSlope(e1, "First equation"),
      ...toSlope(e2, "Second equation"),
      { math: md`\text{same slope, same } y\text{-intercept}`, note: "Both equations describe the same line. The second is the first multiplied through by a number." },
      { math: md`\text{infinitely many solutions}`, note: "Every point on that line makes both equations true." },
    ],
  };
};

// ── Practice: substitution ──────────────────────────────────────────────────

/** A system with one equation already solved for a variable. */
function solvedSystem(r: Parameters<Generator>[0]): { first: string; second: string; answer: string; steps: Step[] } {
  for (;;) {
    const x0 = r.int(-6, 6);
    const y0 = r.int(-6, 6);
    const iso: Var = r.next() < 0.65 ? "y" : "x";
    const o = otherVar(iso);
    const [i0, o0] = iso === "y" ? [y0, x0] : [x0, y0];
    const m = r.nonzero(-4, 4);
    const k = i0 - m * o0;
    if (Math.abs(k) > 12) continue;
    const a = r.nonzero(-5, 5);
    const b = r.nonzero(-5, 5);
    const p = iso === "y" ? b : a;
    const q = iso === "y" ? a : b;
    if (p * m + q === 0) continue;
    const e = through(a, b, x0, y0);
    if (Math.abs(e.c) > 40) continue;
    const solved = `${iso} = ${poly([[m, o], [k, ""]])}`;
    const [first, second] = r.next() < 0.7 ? [solved, eqTex(e)] : [eqTex(e), solved];
    return { first, second, answer: pair(x0, y0), steps: substituteSteps(iso, m, k, e, x0, y0) };
  }
}

const substituteSolved: Generator = (r) => {
  const s = solvedSystem(r);
  return {
    prompt: md`Solve the system $${s.first}$ and $${s.second}$ by substitution. ${PAIR}`,
    answer: s.answer,
    form: "tuple",
    hint: "One equation already says what a variable equals. Replace that variable in the other equation with the expression, in parentheses.",
    solution: s.steps,
  };
};

const isolateThenSubstitute: Generator = (r): Problem => {
  for (;;) {
    const x0 = r.int(-6, 6);
    const y0 = r.int(-6, 6);
    const iso: Var = r.pick(["x", "y"] as const);
    const s = r.sign();
    const t = r.coef(-5, 5);
    const e1 = mk(iso, s, t, x0, y0);
    // s·iso + t·o = c  ⇒  iso = -t·s·o + c·s  (since 1/s = s)
    const m = -t * s;
    const k = e1.c * s;
    if (Math.abs(k) > 15) continue;
    const a = r.coef(-5, 5);
    const b = r.coef(-5, 5);
    const e2 = through(a, b, x0, y0);
    const p = iso === "y" ? b : a;
    const q = iso === "y" ? a : b;
    if (p * m + q === 0 || Math.abs(e2.c) > 40) continue;
    const unitFirst = r.next() < 0.5;
    const [f, g] = unitFirst ? [e1, e2] : [e2, e1];
    const inner = poly([[m, otherVar(iso)], [k, ""]]);
    return {
      prompt: md`Solve the system $${eqTex(f)}$ and $${eqTex(g)}$ by substitution. ${PAIR}`,
      answer: pair(x0, y0),
      form: "tuple",
      hint: "Find a variable whose coefficient is 1 or -1. Solving for it needs no fractions. Then substitute into the other equation.",
      solution: [
        {
          math: `${iso} = ${inner}`,
          note: md`In $${eqTex(e1)}$, $${iso}$ has coefficient ${s}. Move the other term across${s < 0 ? md`, then multiply every term by $-1$` : ""}.`,
        },
        ...substituteSteps(iso, m, k, e2, x0, y0),
      ],
    };
  }
};

const substituteSpecial: Generator = (r): Problem => {
  const kind = r.pick(["one", "one", "none", "many"] as const);
  const hint = "Substitute as usual. If the variable disappears, look at the statement that's left: is it true or false?";
  if (kind === "one") {
    const s = solvedSystem(r);
    return {
      prompt: md`Solve the system $${s.first}$ and $${s.second}$. ${PAIR} ${SPECIAL}`,
      answer: s.answer,
      form: "tuple",
      hint,
      solution: s.steps,
    };
  }
  const m = r.nonzero(-4, 4);
  const k = r.int(-8, 8);
  const d = r.pick([2, 3, -2, -3, -1]);
  const delta = kind === "none" ? r.nonzero(-5, 5) : 0;
  let e: Eq = { a: -m * d, b: d, c: k * d + delta };
  if (e.a < 0) e = scale(e, -1);
  const inner = poly([[m, "x"], [k, ""]]);
  const solved = `y = ${inner}`;
  const [first, second] = r.next() < 0.7 ? [solved, eqTex(e)] : [eqTex(e), solved];
  return {
    prompt: md`Solve the system $${first}$ and $${second}$. ${PAIR} ${SPECIAL}`,
    accept: kind === "none" ? NO_SOLUTION : INFINITELY_MANY,
    hint,
    solution: [
      { math: `${poly([[e.a, "x"]])} ${group(e.b, inner, false)} = ${e.c}`, note: md`Replace $y$ with $${inner}$.` },
      { math: `${poly([[e.a, "x"], [e.b * m, "x"], [e.b * k, ""]])} = ${e.c}`, note: "Distribute." },
      { math: `${e.b * k} = ${e.c}`, note: md`The $x$-terms cancel. No variable is left, only a statement.` },
      kind === "none"
        ? { math: md`\text{no solution}`, note: "The statement is false whatever x is, so no pair works. The lines have the same slope and different intercepts: they are parallel." }
        : { math: md`\text{infinitely many solutions}`, note: "The statement is true whatever x is. Both equations describe the same line, and every point on it is a solution." },
    ],
  };
};

// ── Practice: elimination ───────────────────────────────────────────────────

const eliminateDirect: Generator = (r): Problem => {
  for (;;) {
    const x0 = r.int(-6, 6);
    const y0 = r.int(-6, 6);
    const v: Var = r.pick(["x", "y"] as const);
    const o = otherVar(v);
    const [v0, o0] = v === "x" ? [x0, y0] : [y0, x0];
    const e = r.int(1, 5);
    const add = r.next() < 0.55;
    const p = r.nonzero(-5, 5);
    const q = r.nonzero(-5, 5);
    const oc = add ? p + q : p - q;
    if (oc === 0) continue;
    let e1 = mk(v, e, p, x0, y0);
    let e2 = mk(v, add ? -e : e, q, x0, y0);
    if (add && r.next() < 0.4) [e1, e2] = [e2, e1];
    if (Math.abs(e1.c) > 40 || Math.abs(e2.c) > 40) continue;
    const rhs = add ? e1.c + e2.c : e1.c - e2.c;
    return {
      prompt: md`Solve the system $${eqTex(e1)}$ and $${eqTex(e2)}$ by elimination. ${PAIR}`,
      answer: pair(x0, y0),
      form: "tuple",
      hint: "Compare the coefficients of each variable. If a pair are opposites, add the equations. If they are equal, subtract one equation from the other.",
      solution: [
        add
          ? {
              math: `(${lhsTex(e1)}) + (${lhsTex(e2)}) = ${e1.c} + ${paren(e2.c)}`,
              note: md`The $${v}$-coefficients are opposites, so add the equations: left side to left side, right side to right side.`,
            }
          : {
              math: `(${lhsTex(e1)}) - (${lhsTex(e2)}) = ${e1.c} - ${paren(e2.c)}`,
              note: md`The $${v}$-coefficients are equal, so subtract the whole second equation from the first.`,
            },
        { math: `${poly([[oc, o]])} = ${rhs}`, note: md`The $${v}$-terms cancel, leaving one unknown.${add ? "" : md` Watch the signs: $${p} - ${paren(q)} = ${p - q}$.`}` },
        ...solveFor(oc, o, o0),
        ...backSub(e1, v, o0, v0, "the first equation"),
        { math: pair(x0, y0), note: md`Check in the second equation: ${checkIn(e2, x0, y0)}.` },
      ],
    };
  }
};

const eliminateScaleOne: Generator = (r): Problem => {
  const hint = "Multiply one equation by a number so that one variable gets opposite coefficients in the two equations. Then add.";
  if (r.next() < 0.2) {
    const a = r.nonzero(-4, 4);
    const b = r.nonzero(-4, 4);
    const base = through(a, b, r.int(-4, 4), r.int(-4, 4));
    const k = r.pick([2, 3, -2, -3]);
    const many = r.next() < 0.5;
    const delta = many ? 0 : r.nonzero(-6, 6);
    const other: Eq = { a: k * a, b: k * b, c: k * base.c + delta };
    const baseFirst = r.next() < 0.5;
    const [e1, e2] = baseFirst ? [base, other] : [other, base];
    const [bw, ow] = baseFirst ? ["first", "second"] : ["second", "first"];
    return {
      prompt: md`Solve the system $${eqTex(e1)}$ and $${eqTex(e2)}$. ${PAIR} ${SPECIAL}`,
      accept: many ? INFINITELY_MANY : NO_SOLUTION,
      hint,
      solution: [
        { math: eqTex(scale(base, -k)), note: md`The left side of the ${ow} equation is ${k} times the left side of the ${bw}. Multiply the ${bw} equation by $${-k}$.` },
        { math: `0 = ${delta}`, note: md`Add it to the ${ow} equation. **Both** variables cancel.` },
        many
          ? { math: md`\text{infinitely many solutions}`, note: md`$0 = 0$ is always true. The two equations describe the same line, and every point on it is a solution.` }
          : { math: md`\text{no solution}`, note: md`$0 = ${delta}$ is never true, so no pair works. The lines are parallel.` },
      ],
    };
  }
  for (;;) {
    const x0 = r.int(-5, 5);
    const y0 = r.int(-5, 5);
    const v: Var = r.pick(["x", "y"] as const);
    const o = otherVar(v);
    const [v0, o0] = v === "x" ? [x0, y0] : [y0, x0];
    const s = r.pick([1, -1, 1, -1, 2, -2]);
    const k = r.pick([2, 3, 4, -2, -3]);
    const A = s * k;
    if (Math.abs(A) > 8) continue;
    const p = r.nonzero(-5, 5);
    const q = r.nonzero(-5, 5);
    if (Math.abs(p) === Math.abs(q)) continue;
    const f = -k;
    const newO = p + f * q;
    if (newO === 0) continue;
    const big = mk(v, A, p, x0, y0);
    const small = mk(v, s, q, x0, y0);
    if (Math.abs(big.c) > 40 || Math.abs(small.c) > 40) continue;
    const smallFirst = r.next() < 0.5;
    const [e1, e2] = smallFirst ? [small, big] : [big, small];
    const [sw, bw] = smallFirst ? ["first", "second"] : ["second", "first"];
    const scaled = scale(small, f);
    return {
      prompt: md`Solve the system $${eqTex(e1)}$ and $${eqTex(e2)}$. ${PAIR} ${SPECIAL}`,
      answer: pair(x0, y0),
      form: "tuple",
      hint,
      solution: [
        { math: eqTex(scaled), note: md`Multiply every term of the ${sw} equation by $${f}$. Its $${v}$-coefficient becomes $${-A}$, the opposite of the $${A}$ in the ${bw} equation.` },
        { math: `${poly([[newO, o]])} = ${big.c + scaled.c}`, note: md`Add this to the ${bw} equation. The $${v}$-terms cancel.` },
        ...solveFor(newO, o, o0),
        ...backSub(small, v, o0, v0, `the ${sw} equation`),
        { math: pair(x0, y0), note: md`Check in the ${bw} equation: ${checkIn(big, x0, y0)}.` },
      ],
    };
  }
};

const eliminateScaleBoth: Generator = (r): Problem => {
  for (;;) {
    const x0 = r.int(-5, 5);
    const y0 = r.int(-5, 5);
    const v: Var = r.pick(["x", "y"] as const);
    const o = otherVar(v);
    const [v0, o0] = v === "x" ? [x0, y0] : [y0, x0];
    const a1 = r.coef(-5, 5);
    const a2 = r.coef(-5, 5);
    const p = r.coef(-5, 5);
    const q = r.coef(-5, 5);
    if (gcd(a1, a2) !== 1 || gcd(p, q) !== 1 || a1 * q === a2 * p) continue;
    let [f1, f2] = [a2, -a1];
    if (f1 < 0) [f1, f2] = [-f1, -f2];
    const e1 = mk(v, a1, p, x0, y0);
    const e2 = mk(v, a2, q, x0, y0);
    if (Math.abs(e1.c) > 40 || Math.abs(e2.c) > 40) continue;
    const s1 = scale(e1, f1);
    const s2 = scale(e2, f2);
    const newO = f1 * p + f2 * q;
    return {
      prompt: md`Solve the system $${eqTex(e1)}$ and $${eqTex(e2)}$ by elimination. ${PAIR}`,
      answer: pair(x0, y0),
      form: "tuple",
      hint: md`Neither coefficient divides the other, so multiply **both** equations. Aim for opposite coefficients on one variable, using a common multiple of the two coefficients.`,
      solution: [
        { math: eqTex(s1), note: md`To cancel $${v}$, make its coefficients $${f1 * a1}$ and $${f2 * a2}$. Multiply the first equation by ${f1}.` },
        { math: eqTex(s2), note: md`Multiply the second equation by $${f2}$.` },
        { math: `${poly([[newO, o]])} = ${s1.c + s2.c}`, note: md`Add the two new equations. The $${v}$-terms cancel.` },
        ...solveFor(newO, o, o0),
        ...backSub(e1, v, o0, v0, "the original first equation"),
        { math: pair(x0, y0), note: md`Check in the second equation: ${checkIn(e2, x0, y0)}.` },
      ],
    };
  }
};

// ── Practice: modeling ──────────────────────────────────────────────────────

const countAndValue: Generator = (r): Problem => {
  const kind = r.int(0, 3);
  let X: string, Y: string, vx: number, vy: number, x: number, y: number, story: (n: number, T: number) => string, note1: string, note2: string, what: string;
  if (kind === 0) {
    [X, Y] = ["a", "s"];
    vx = r.int(7, 12);
    vy = r.int(3, vx - 2);
    [x, y] = [r.int(4, 30), r.int(4, 30)];
    story = (n, T) =>
      md`A school play sold ${n} tickets and took in ${T} dollars. Adult tickets cost ${vx} dollars and student tickets cost ${vy} dollars. How many adult tickets and how many student tickets were sold? Answer as (adult, student).`;
    note1 = md`Let $a$ be the number of adult tickets and $s$ the number of student tickets. Every ticket is one or the other, so the counts add up to the total.`;
    note2 = md`Each adult ticket brings in ${vx} dollars and each student ticket ${vy}. Together that's the money taken in.`;
    what = "money";
  } else if (kind === 1) {
    [X, Y] = ["q", "d"];
    [vx, vy] = [25, 10];
    [x, y] = [r.int(2, 20), r.int(2, 20)];
    story = (n, T) => md`A jar holds ${n} coins, all quarters and dimes, worth ${T} cents in total. How many quarters and how many dimes are there? Answer as (quarters, dimes).`;
    note1 = md`Let $q$ be the number of quarters and $d$ the number of dimes. Every coin is one or the other.`;
    note2 = "A quarter is worth 25 cents and a dime 10. Working in cents keeps every number whole.";
    what = "value";
  } else if (kind === 2) {
    [X, Y] = ["g", "c"];
    [vx, vy] = [4, 2];
    [x, y] = [r.int(2, 20), r.int(2, 30)];
    story = (n, T) => md`A farm has goats and chickens. Together they have ${n} heads and ${T} legs. How many goats and how many chickens are there? Answer as (goats, chickens).`;
    note1 = md`Let $g$ be the number of goats and $c$ the number of chickens. Each animal has one head.`;
    note2 = "Each goat has 4 legs and each chicken has 2.";
    what = "legs";
  } else {
    [X, Y] = ["f", "p"];
    vx = r.int(3, 7);
    vy = r.int(1, vx - 1);
    [x, y] = [r.int(2, 10), r.int(2, 12)];
    story = (n, T) =>
      md`Sam bought ${n} school supplies, folders at ${vx} dollars each and pens at ${vy} dollar${vy === 1 ? "" : "s"} each, and spent ${T} dollars. How many folders and how many pens did Sam buy? Answer as (folders, pens).`;
    note1 = md`Let $f$ be the number of folders and $p$ the number of pens. Every item is one or the other.`;
    note2 = md`Folders cost ${vx} dollars each and pens ${vy}. Together that's what Sam spent.`;
    what = "money";
  }
  const n = x + y;
  const T = vx * x + vy * y;
  const d = vy - vx;
  return {
    prompt: story(n, T),
    answer: pair(x, y),
    form: "tuple",
    hint: md`Name the two unknowns. Write one equation for how many there are and one for the total ${what}. Then solve the first for one letter and substitute.`,
    solution: [
      { math: `${X} + ${Y} = ${n}`, note: note1 },
      { math: `${vx}${X} + ${poly([[vy, Y]])} = ${T}`, note: note2 },
      { math: `${X} = ${n} - ${Y}`, note: md`Solve the first equation for $${X}$.` },
      { math: `${vx}(${n} - ${Y}) + ${poly([[vy, Y]])} = ${T}`, note: "Substitute into the second equation." },
      { math: `${poly([[vx * n, ""], [-vx, Y], [vy, Y]])} = ${T}`, note: "Distribute." },
      { math: `${poly([[vx * n, ""], [d, Y]])} = ${T}`, note: "Combine like terms." },
      { math: `${poly([[d, Y]])} = ${T - vx * n}`, note: md`Subtract ${vx * n} from both sides.` },
      { math: `${Y} = ${y}`, note: md`Divide both sides by ${d}.` },
      { math: `${X} = ${n} - ${y} = ${x}`, note: "Put it back into the first equation." },
      { math: pair(x, y), note: md`Check against the story: $${x} + ${y} = ${n}$ and $${vx}(${x}) + ${vy}(${y}) = ${T} \;\checkmark$.` },
    ],
  };
};

const PLANS = [
  { who: ["Gym A", "Gym B"], fee: "joining fee", unit: "month", units: "months", rate: [10, 30], dr: [5, 15], fee2: [0, 6], feeStep: 5, n: [2, 8] },
  { who: ["Taxi A", "Taxi B"], fee: "pickup fee", unit: "mile", units: "miles", rate: [1, 3], dr: [1, 2], fee2: [2, 5], feeStep: 1, n: [3, 12] },
  { who: ["Rental A", "Rental B"], fee: "booking fee", unit: "day", units: "days", rate: [20, 40], dr: [5, 15], fee2: [0, 4], feeStep: 5, n: [2, 7] },
] as const;

const ratesAndComparisons: Generator = (r): Problem => {
  const kind = r.pick(["plans", "plans", "current", "current", "sum"] as const);
  if (kind === "plans") {
    const c = r.pick(PLANS);
    const r1 = r.int(c.rate[0], c.rate[1]);
    const dr = r.int(c.dr[0], c.dr[1]);
    const r2 = r1 + dr;
    const F2 = r.int(c.fee2[0], c.fee2[1]) * c.feeStep;
    const n = r.int(c.n[0], c.n[1]);
    const F1 = F2 + dr * n;
    const C = F1 + r1 * n;
    const [A, B] = c.who;
    const plan2 = F2 === 0 ? md`${B} has no ${c.fee} and charges ${r2} dollars per ${c.unit}.` : md`${B} charges a ${F2}-dollar ${c.fee} plus ${r2} dollars per ${c.unit}.`;
    const cost2 = poly([[F2, ""], [r2, "n"]]);
    return {
      prompt: md`${A} charges a ${F1}-dollar ${c.fee} plus ${r1} dollar${r1 === 1 ? "" : "s"} per ${c.unit}. ${plan2} For how many ${c.units} do the two cost the same, and what is that cost in dollars? Answer as (${c.units}, cost).`,
      answer: pair(n, C),
      form: "tuple",
      hint: md`Let $n$ be the number of ${c.units} and $C$ the cost. Write $C = \ldots$ for each company, then set the two expressions equal.`,
      solution: [
        { math: `C = ${F1} + ${r1}n`, note: md`${A}: the fee once, plus ${r1} for each ${c.unit}.` },
        { math: `C = ${cost2}`, note: md`${B}, the same way.` },
        { math: `${F1} + ${r1}n = ${cost2}`, note: md`Both expressions equal $C$, so they equal each other. This is substitution.` },
        { math: `${F1 - F2} = ${poly([[dr, "n"]])}`, note: md`Subtract $${r1}n$${F2 ? md` and ${F2}` : ""} from both sides.` },
        ...solveFor(dr, "n", n),
        { math: `C = ${F1} + ${r1}(${n}) = ${C}`, note: "Put it back into the first equation." },
        { math: pair(n, C), note: md`Check with ${B}: $${F2 ? `${F2} + ` : ""}${r2}(${n}) = ${C} \;\checkmark$.` },
      ],
    };
  }
  if (kind === "current") {
    const plane = r.next() < 0.4;
    let t1: number, t2: number, g: number;
    for (;;) {
      t1 = plane ? r.int(2, 5) : r.int(1, 4);
      t2 = plane ? t1 + 1 : t1 + r.int(1, 3);
      g = plane ? r.pick([80, 100, 120, 160, 200]) : r.int(1, 6);
      if ((g * (t1 + t2)) % 2 === 0) break;
    }
    const w = g * t2;
    const u = g * t1;
    const D = g * t1 * t2;
    const b = (w + u) / 2;
    const c = (w - u) / 2;
    const [B, Cv] = plane ? ["p", "w"] : ["b", "c"];
    const prompt = plane
      ? md`A plane flies ${D} km with the wind in ${t1} hours. Flying back against the wind takes ${t2} hours. Find the plane's speed in still air and the speed of the wind, in km per hour. Answer as (plane, wind).`
      : md`A boat travels ${D} km downstream in ${t1} hour${t1 === 1 ? "" : "s"}. The trip back upstream takes ${t2} hours. Find the boat's speed in still water and the speed of the current, in km per hour. Answer as (boat, current).`;
    const helper = plane ? "wind" : "current";
    return {
      prompt,
      answer: pair(b, c),
      form: "tuple",
      hint: md`Speed is distance divided by time. Going with the ${helper}, the two speeds add; going against it, the ${helper} subtracts.`,
      solution: [
        { math: md`${B} + ${Cv} = \frac{${D}}{${t1}} = ${w}`, note: md`Let $${B}$ be the ${plane ? "plane's" : "boat's"} own speed and $${Cv}$ the ${helper}'s. With the ${helper}, the speeds add.` },
        { math: md`${B} - ${Cv} = \frac{${D}}{${t2}} = ${u}`, note: md`Against the ${helper}, it takes away from the speed.` },
        { math: `2${B} = ${w + u}`, note: md`Add the equations: $${Cv}$ cancels.` },
        { math: `${B} = ${b}`, note: "Divide by 2." },
        { math: `${Cv} = ${w} - ${b} = ${c}`, note: "Put it back into the first equation." },
        { math: pair(b, c), note: md`Check against the story: $(${b} - ${c}) \cdot ${t2} = ${D}$ km $\;\checkmark$.` },
      ],
    };
  }
  const big = r.int(12, 60);
  const small = r.int(2, big - 2);
  const S = big + small;
  const D = big - small;
  return {
    prompt: md`Two numbers add up to ${S}. The larger one is ${D} more than the smaller one. Find both numbers. Answer as (larger, smaller).`,
    answer: pair(big, small),
    form: "tuple",
    hint: md`Let $x$ be the larger number and $y$ the smaller. One equation for the sum, one for the difference. Adding them cancels $y$.`,
    solution: [
      { math: `x + y = ${S}`, note: "The sum." },
      { math: `x - y = ${D}`, note: md`"${D} more than the smaller" means the difference is ${D}.` },
      { math: `2x = ${S + D}`, note: md`Add the equations: $y$ cancels.` },
      { math: `x = ${big}`, note: "Divide by 2." },
      { math: `y = ${S} - ${big} = ${small}`, note: "Put it back into the first equation." },
      { math: pair(big, small), note: md`Check: $${big} - ${small} = ${D} \;\checkmark$.` },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit5: Unit = {
  title: "Systems of Linear Equations",
  lessons: [
    {
      id: "solving-systems-by-graphing",
      title: "Solving systems by graphing",
      summary: "What a system is, why the crossing point solves it, and the three ways two lines can meet.",
      blocks: [
        {
          kind: "text",
          body: md`So far each equation had one unknown. Plenty of questions have two. Here's one: two numbers add up to 5, and the second is 1 more than the first. What are they?

Each fact is an equation in two unknowns:

$$x + y = 5 \qquad y = x + 1$$

The first fact alone has endless answers: $(0, 5)$, $(1, 4)$, $(2, 3)$, $(4.5, 0.5)$ and so on. The second alone has endless answers too. Asking for **both** at once narrows it down to one pair, $(2, 3)$.`,
        },
        {
          kind: "key",
          title: "System of equations",
          body: md`A **system of linear equations** is two or more linear equations in the same variables, meant to be true at the same time.

A **solution of the system** is an ordered pair $(x, y)$ that makes **every** equation in it true. Solving the system means finding all such pairs.`,
        },
        {
          kind: "example",
          title: "Checking a pair",
          problem: md`Which of $(2, 3)$ and $(1, 4)$ solves the system $x + y = 5$ and $y = x + 1$?`,
          steps: [
            { math: md`2 + 3 = 5 \;\checkmark \qquad 3 = 2 + 1 \;\checkmark`, note: md`Put $x = 2$, $y = 3$ into each equation. Both are true, so $(2, 3)$ is a solution.` },
            { math: md`1 + 4 = 5 \;\checkmark \qquad 4 \ne 1 + 1`, note: md`$(1, 4)$ passes the first test and fails the second.` },
            { math: md`(2, 3)`, note: "Working in one equation isn't enough. A solution of the system must work in all of them." },
          ],
        },
        {
          kind: "why",
          title: "Why is the crossing point the solution?",
          body: md`In Unit 4 you saw that the graph of an equation is the picture of **all** the points that make it true. A point is on the line exactly when its coordinates satisfy the equation.

So a pair that satisfies both equations is a point that lies on both lines. Two lines share a point only where they cross. That makes the crossing point the solution, and nothing else can be one.`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 6],
          curves: [
            { expr: "x + 1", label: "y = x + 1", color: 1 },
            { expr: "-x + b", label: "x + y = b", color: 2 },
          ],
          points: [{ x: "(b - 1)/2", y: "(b + 1)/2", label: md`\text{solution}`, color: 3 }],
          params: [{ name: "b", label: "b", min: -4, max: 8, step: 1, value: 5 }],
          caption: md`The orange line is $x + y = b$, which is $y = -x + b$. At $b = 5$ it's the system above, crossing at $(2, 3)$. Drag $b$: the crossing point moves, and it is always the one pair that fits both equations.`,
        },
        {
          kind: "key",
          title: "Solving by graphing",
          body: md`- Rewrite each equation in slope-intercept form, $y = mx + b$.
- Graph both lines: start at the $y$-intercept, step by the slope.
- Read off the point where they cross.
- Check that point in **both** original equations.`,
        },
        {
          kind: "example",
          title: "A system in standard form",
          problem: md`Solve the system $2x + y = 4$ and $x - y = 5$ by graphing.`,
          steps: [
            { math: md`y = -2x + 4`, note: md`Subtract $2x$ from both sides of the first equation. Intercept 4, slope $-2$.` },
            { math: md`y = x - 5`, note: md`From $x - y = 5$: subtract $x$ to get $-y = -x + 5$, then multiply by $-1$. Intercept $-5$, slope 1.` },
            { math: md`(0, 4), (1, 2), (2, 0), (3, -2)`, note: "Points on the first line: each step right goes down 2." },
            { math: md`(0, -5), (1, -4), (2, -3), (3, -2)`, note: "Points on the second: each step right goes up 1. Both lists reach $(3, -2)$." },
            { math: md`2(3) + (-2) = 4 \;\checkmark \qquad 3 - (-2) = 5 \;\checkmark`, note: md`Check in the original equations. The solution is $(3, -2)$.` },
          ],
        },
        {
          kind: "plot",
          x: [-2, 7],
          y: [-6, 6],
          curves: [
            { expr: "-2x + 4", label: "2x + y = 4", color: 1 },
            { expr: "x - 5", label: "x - y = 5", color: 2 },
          ],
          points: [{ x: 3, y: -2, label: "(3, -2)", color: 3 }],
          caption: "The two lines of the example meet at one point.",
        },
        {
          kind: "text",
          body: md`Two lines don't always cross exactly once. Graph $y = 2x + 1$ and $y = 2x - 3$ and they never meet: the system has **no solution**. Graph $x + y = 3$ and $2x + 2y = 6$ and you draw the same line twice: every point on it is a solution, so there are **infinitely many**.`,
        },
        {
          kind: "plot",
          x: [-5, 5],
          y: [-6, 6],
          curves: [
            { expr: "2x + 1", label: "y = 2x + 1", color: 1 },
            { expr: "2x - 3", label: "y = 2x - 3", color: 2 },
          ],
          caption: "Same slope, different intercepts. At every x the blue line is exactly 4 above the orange one, so they never meet.",
        },
        {
          kind: "why",
          title: "Why only none, one, or infinitely many?",
          body: md`Compare the two lines in slope-intercept form.

- **Different slopes.** One line climbs faster than the other, so the gap between them shrinks on one side, hits zero once, then grows the other way. They cross exactly once. They can't cross twice: through two points there is only one line, so two lines that share two points are the same line.
- **Same slope, different intercepts.** Both rise at the same rate, so the vertical gap between them is the same at every $x$. It is never zero: no solution.
- **Same slope, same intercept.** Same line. Infinitely many solutions.

This mirrors Unit 2, where an equation could have one solution, none, or every number.`,
        },
        {
          kind: "check",
          prompt: md`Is $(3, -1)$ a solution of the system $x + y = 2$ and $2x - y = 5$? Type **yes** or **no**.`,
          accept: ["no"],
          explain: md`First equation: $3 + (-1) = 2$, true. Second: $2(3) - (-1) = 7$, and $7 \ne 5$. It's on the first line only, so it is not a solution of the system.`,
        },
        {
          kind: "check",
          prompt: md`Solve the system $y = x + 2$ and $y = -2x + 5$ by graphing. Give the answer as $(x, y)$.`,
          answer: "(1, 3)",
          form: "tuple",
          explain: md`The first line goes $(0, 2), (1, 3)$. The second goes $(0, 5), (1, 3)$. They meet at $(1, 3)$. Check: $3 = 1 + 2$ and $3 = -2 + 5$.`,
        },
      ],
      practice: [isSolution, graphSlopeIntercept, graphStandardForm],
    },
    {
      id: "substitution",
      title: "Substitution",
      summary: "Replacing a variable with an equal expression, so two unknowns become one.",
      blocks: [
        {
          kind: "text",
          body: md`Graphing shows what a solution means, but it is only as accurate as your drawing. Where do $y = 2x + 1$ and $y = -x + 2$ cross?`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-2, 4],
          curves: [
            { expr: "2x + 1", label: "y = 2x + 1", color: 1 },
            { expr: "-x + 2", label: "y = -x + 2", color: 2 },
          ],
          points: [{ x: 1 / 3, y: 5 / 3, color: 3 }],
          caption: "They cross between grid lines, somewhere near (0.3, 1.7). The picture can't tell you exactly where.",
        },
        {
          kind: "text",
          body: md`Algebra can. At the crossing point both equations are true for the same $x$ and the same $y$. The first equation says what $y$ is there: $2x + 1$. So in the second equation, write $2x + 1$ where it says $y$.`,
        },
        {
          kind: "why",
          title: "Why are we allowed to substitute?",
          body: md`An equation says that two expressions are two names for one number (Unit 2). At the solution, $y = 2x + 1$ is true, so $y$ and $2x + 1$ are the same number there.

Replacing a number with another name for the same number can't change whether a statement is true. You did the same thing in Unit 1 when you evaluated an expression by writing $3$ in place of $x$.

The payoff is that the new equation has only one unknown, and you already know how to solve those.`,
        },
        {
          kind: "example",
          title: "The crossing point, exactly",
          problem: md`Solve the system $y = 2x + 1$ and $y = -x + 2$.`,
          steps: [
            { math: md`2x + 1 = -x + 2`, note: md`Replace $y$ in the second equation with $2x + 1$.` },
            { math: md`3x = 1`, note: md`Add $x$ to both sides, then subtract 1.` },
            { math: md`x = \frac{1}{3}`, note: "Divide by 3." },
            { math: md`y = 2 \cdot \frac{1}{3} + 1 = \frac{5}{3}`, note: md`Put $x$ back into the first equation to find $y$.` },
            { math: md`\left(\frac{1}{3}, \frac{5}{3}\right)`, note: md`Check in the second: $-\frac{1}{3} + 2 = \frac{5}{3}$ ✓. The graph's guess of $(0.3, 1.7)$ was close.` },
          ],
        },
        {
          kind: "key",
          title: "The substitution method",
          body: md`- Solve one equation for one variable, if that isn't done already.
- Substitute that expression, in parentheses, into the **other** equation.
- Solve the one-variable equation you get.
- Put that value back in to find the other variable.
- Check the pair in both original equations.`,
        },
        {
          kind: "example",
          title: "Keep the parentheses",
          problem: md`Solve the system $y = 3x - 5$ and $4x - 2y = 2$.`,
          steps: [
            { math: md`4x - 2(3x - 5) = 2`, note: md`Replace $y$ with $(3x - 5)$. The $-2$ multiplies the whole expression.` },
            { math: md`4x - 6x + 10 = 2`, note: md`Distribute $-2$: $-2 \cdot (-5) = +10$.` },
            { math: md`-2x + 10 = 2`, note: "Combine like terms." },
            { math: md`-2x = -8 \Rightarrow x = 4`, note: md`Subtract 10, then divide by $-2$.` },
            { math: md`y = 3(4) - 5 = 7`, note: md`Back into $y = 3x - 5$.` },
            { math: md`(4, 7)`, note: md`Check: $4(4) - 2(7) = 16 - 14 = 2$ ✓.` },
          ],
        },
        {
          kind: "text",
          body: md`If neither equation is solved for a variable yet, pick one with coefficient $1$ or $-1$. Solving for it needs no division, so no fractions appear.`,
        },
        {
          kind: "example",
          title: "Isolate first",
          problem: md`Solve the system $x - 2y = 1$ and $3x + 4y = 23$.`,
          steps: [
            { math: md`x = 2y + 1`, note: md`In the first equation $x$ has coefficient 1. Add $2y$ to both sides.` },
            { math: md`3(2y + 1) + 4y = 23`, note: md`Substitute into the second equation.` },
            { math: md`6y + 3 + 4y = 23 \Rightarrow 10y = 20`, note: "Distribute, combine, subtract 3." },
            { math: md`y = 2, \quad x = 2(2) + 1 = 5`, note: md`Divide by 10, then use $x = 2y + 1$.` },
            { math: md`(5, 2)`, note: md`Check: $5 - 4 = 1$ ✓ and $15 + 8 = 23$ ✓.` },
          ],
        },
        {
          kind: "why",
          title: "What if the variable disappears?",
          body: md`Try $y = 3x + 2$ and $6x - 2y = 5$. Substituting gives $6x - 2(3x + 2) = 5$, so $6x - 6x - 4 = 5$, which is $-4 = 5$.

The $x$ vanished and left a false statement. No value of $x$ can make it true, so **no pair** satisfies both equations: there is **no solution**. The picture agrees. The second equation is $y = 3x - \frac{5}{2}$, with the same slope as the first and a different intercept. Parallel lines.

If the leftover statement is true, like $4 = 4$, then every $x$ works, and each $x$ gets its $y$ from the first equation. That's every point of one line: **infinitely many solutions**. It's the same pattern as the no-solution and identity equations in Unit 2.`,
        },
        {
          kind: "check",
          prompt: md`Solve the system $y = x - 4$ and $3x + y = 8$. Give the answer as $(x, y)$.`,
          answer: "(3, -1)",
          form: "tuple",
          explain: md`Substitute: $3x + (x - 4) = 8$, so $4x = 12$ and $x = 3$. Then $y = 3 - 4 = -1$.`,
        },
        {
          kind: "check",
          prompt: md`Solve the system $y = 2x + 3$ and $4x - 2y = -6$. If there is no solution, type **no solution**. If there are infinitely many, type **infinitely many**.`,
          accept: INFINITELY_MANY,
          explain: md`Substitute: $4x - 2(2x + 3) = -6$ gives $4x - 4x - 6 = -6$, so $-6 = -6$. Always true: the second equation is the first one rearranged, so they are the same line.`,
        },
      ],
      practice: [substituteSolved, isolateThenSubstitute, substituteSpecial],
    },
    {
      id: "elimination",
      title: "Elimination",
      summary: "Adding equations so that a variable cancels, and why that's legal.",
      blocks: [
        {
          kind: "text",
          body: md`Substitution is easy when some variable has coefficient 1. In $3x + 2y = 16$ and $5x - 2y = 16$ none does, and isolating anything brings in fractions.

But look at the $y$-terms: $+2y$ and $-2y$. If we could add the two equations, the $y$'s would cancel.`,
        },
        {
          kind: "why",
          title: "Why can we add two equations?",
          body: md`Suppose $a = b$ and $c = d$. Start from $a = b$ and add $c$ to both sides, which the properties of equality allow:

$$a + c = b + c$$

Now $c = d$, so on the right we may substitute $d$ for $c$:

$$a + c = b + d$$

That's the whole rule: **equals added to equals give equals**. At the solution of a system, each equation is a true statement $a = b$, so their sum is true too.

Nothing is lost either. From the sum you can get the original second equation back by subtracting the first. So the new pair of equations has exactly the same solutions as the old pair.`,
        },
        {
          kind: "key",
          title: "Adding and subtracting equations",
          body: md`If $a = b$ and $c = d$, then

$$a + c = b + d \quad\text{and}\quad a - c = b - d.$$

Add left side to left side and right side to right side. Choose the operation that makes one variable cancel.`,
        },
        {
          kind: "example",
          title: "Opposite coefficients: add",
          problem: md`Solve the system $3x + 2y = 16$ and $5x - 2y = 16$.`,
          steps: [
            { math: md`(3x + 2y) + (5x - 2y) = 16 + 16`, note: "Add the equations." },
            { math: md`8x = 32`, note: md`$2y$ and $-2y$ cancel.` },
            { math: md`x = 4`, note: "Divide by 8." },
            { math: md`3(4) + 2y = 16 \Rightarrow 2y = 4 \Rightarrow y = 2`, note: md`Put $x = 4$ into either original equation.` },
            { math: md`(4, 2)`, note: md`Check in the other: $5(4) - 2(2) = 16$ ✓.` },
          ],
        },
        {
          kind: "plot",
          x: [-1, 8],
          y: [-5, 10],
          curves: [
            { expr: "-1.5x + 8", label: "3x + 2y = 16", color: 1 },
            { expr: "2.5x - 8", label: "5x - 2y = 16", color: 2 },
          ],
          vlines: [{ x: 4, label: "x = 4" }],
          points: [{ x: 4, y: 2, label: "(4, 2)", color: 3 }],
          caption: md`Adding the equations made a new one, $8x = 32$, which is the dashed line $x = 4$. It lost $y$, but it still runs through the solution, because adding true statements gives a true statement.`,
        },
        {
          kind: "example",
          title: "Equal coefficients: subtract",
          problem: md`Solve the system $2x + 5y = -1$ and $2x + y = -5$.`,
          steps: [
            { math: md`(2x + 5y) - (2x + y) = -1 - (-5)`, note: md`Both have $2x$. Subtract the second equation from the first, **every** term.` },
            { math: md`4y = 4 \Rightarrow y = 1`, note: md`$2x - 2x = 0$, $5y - y = 4y$, and $-1 + 5 = 4$.` },
            { math: md`2x + 1 = -5 \Rightarrow x = -3`, note: "Back into the second equation." },
            { math: md`(-3, 1)`, note: md`Check: $2(-3) + 5(1) = -1$ ✓.` },
          ],
        },
        {
          kind: "text",
          body: md`Often no coefficients match. Then **multiply** one equation, or both, by a number first, chosen to make one pair of coefficients opposites.`,
        },
        {
          kind: "why",
          title: "Why doesn't multiplying an equation change its solutions?",
          body: md`It's the multiplication property of equality: if $a = b$ then $3a = 3b$. Any pair that made the equation true still does.

It also can't add new solutions, since you can divide by 3 again to get back where you started. So $x + 2y = 3$ and $3x + 6y = 9$ have exactly the same solutions. They are the same line. The only number you may not multiply by is 0, which turns every equation into $0 = 0$ and throws the information away.`,
        },
        {
          kind: "example",
          title: "Multiply one equation",
          problem: md`Solve the system $2x + 3y = 12$ and $5x - y = 13$.`,
          steps: [
            { math: md`15x - 3y = 39`, note: md`Multiply every term of the second equation by 3, so its $y$-term becomes $-3y$, the opposite of $3y$.` },
            { math: md`17x = 51 \Rightarrow x = 3`, note: "Add it to the first equation. The y's cancel." },
            { math: md`5(3) - y = 13 \Rightarrow y = 2`, note: "Back into the original second equation." },
            { math: md`(3, 2)`, note: md`Check: $2(3) + 3(2) = 12$ ✓.` },
          ],
        },
        {
          kind: "example",
          title: "Multiply both equations",
          problem: md`Solve the system $4x + 3y = 2$ and $3x + 2y = 1$.`,
          steps: [
            { math: md`8x + 6y = 4`, note: md`The $y$-coefficients are 3 and 2. Both divide 6, so aim for $6y$ and $-6y$. Multiply the first equation by 2.` },
            { math: md`-9x - 6y = -3`, note: md`Multiply the second by $-3$.` },
            { math: md`-x = 1 \Rightarrow x = -1`, note: "Add the new equations." },
            { math: md`3(-1) + 2y = 1 \Rightarrow 2y = 4 \Rightarrow y = 2`, note: "Back into the second original equation." },
            { math: md`(-1, 2)`, note: md`Check: $4(-1) + 3(2) = 2$ ✓.` },
          ],
        },
        {
          kind: "key",
          title: "The elimination method",
          body: md`- Line up the equations: $x$-terms, $y$-terms, $=$, number.
- If needed, multiply one or both equations so one variable has opposite coefficients.
- Add the equations. That variable cancels.
- Solve for the other variable, then substitute back.
- Check in both original equations.

If **both** variables cancel, look at what's left. $0 = 0$ means the same line: infinitely many solutions. Something false like $0 = 9$ means parallel lines: no solution.`,
        },
        {
          kind: "check",
          prompt: md`Solve the system $2x + y = 9$ and $3x - y = 11$. Give the answer as $(x, y)$.`,
          answer: "(4, 1)",
          form: "tuple",
          explain: md`Add: $5x = 20$, so $x = 4$. Then $2(4) + y = 9$ gives $y = 1$.`,
        },
        {
          kind: "check",
          prompt: md`Solve the system $2x - 3y = 4$ and $-4x + 6y = 1$. If there is no solution, type **no solution**. If there are infinitely many, type **infinitely many**.`,
          accept: NO_SOLUTION,
          explain: md`Multiply the first by 2: $4x - 6y = 8$. Add it to the second: $0 = 9$, which is false. The lines are parallel.`,
        },
      ],
      practice: [eliminateDirect, eliminateScaleOne, eliminateScaleBoth],
    },
    {
      id: "modeling-with-systems",
      title: "Modeling with systems",
      summary: "Turning a story with two unknowns into two equations, then checking the answer against the story.",
      blocks: [
        {
          kind: "text",
          body: md`Many real questions have two unknown amounts tied together by two facts. How many adult and how many student tickets were sold? After how many months do two gyms cost the same? Each fact becomes an equation, and the system does the rest.`,
        },
        {
          kind: "why",
          title: "Why do two unknowns need two facts?",
          body: md`One equation in two unknowns, like $a + s = 23$, has a whole line of solutions: $(0, 23)$, $(1, 22)$, $(2, 21)$ and so on. One fact can't pin down two numbers.

A second, different fact is a second line. Unless the lines are parallel or identical, they cross at exactly one point, and that point is the one pair that fits both facts. In general you need as many independent facts as unknowns.`,
        },
        {
          kind: "key",
          title: "Modeling recipe",
          body: md`- **Name the unknowns.** Pick a letter for each and say what it stands for, with units.
- **Write one equation per fact.**
- **Solve** with whichever method fits: substitution when a letter is easy to isolate, elimination otherwise.
- **Answer the question** that was asked, in words.
- **Check** the numbers against the original story.`,
        },
        {
          kind: "text",
          body: md`Two patterns come up again and again:

- **Count and value.** Two kinds of thing: tickets, coins, animals. One equation counts them, the other adds up their value (or legs, or cost).
- **Two rates.** A fixed amount plus a rate, like a joining fee plus a monthly charge. Or a speed that a current or wind adds to one way and takes away the other way.`,
        },
        {
          kind: "example",
          title: "Count and value",
          problem: md`A school play sold 23 tickets for 142 dollars. Adult tickets cost 8 dollars and student tickets 5 dollars. How many of each were sold?`,
          steps: [
            { math: md`a + s = 23`, note: md`Let $a$ = adult tickets, $s$ = student tickets. The counts add to 23.` },
            { math: md`8a + 5s = 142`, note: "The money: 8 dollars per adult ticket, 5 per student ticket." },
            { math: md`8(23 - s) + 5s = 142`, note: md`Solve the first for $a = 23 - s$ and substitute.` },
            { math: md`184 - 3s = 142 \Rightarrow s = 14`, note: md`Distribute and combine, then subtract 184 and divide by $-3$.` },
            { math: md`a = 23 - 14 = 9`, note: "Back into the first equation." },
            { math: md`9 \text{ adult}, \; 14 \text{ student}`, note: md`Check: $9 + 14 = 23$ tickets and $72 + 70 = 142$ dollars ✓.` },
          ],
        },
        {
          kind: "example",
          title: "When do two plans cost the same?",
          problem: md`Gym A charges 40 dollars to join plus 15 dollars a month. Gym B charges 10 dollars to join plus 25 dollars a month. When is the total cost the same?`,
          steps: [
            { math: md`C = 40 + 15m`, note: md`Let $m$ = months and $C$ = total cost in dollars. Gym A.` },
            { math: md`C = 10 + 25m`, note: "Gym B." },
            { math: md`40 + 15m = 10 + 25m`, note: md`Both equal $C$, so substitute one for the other.` },
            { math: md`30 = 10m \Rightarrow m = 3`, note: md`Subtract $15m$ and 10 from both sides, then divide by 10.` },
            { math: md`C = 40 + 15(3) = 85`, note: "After 3 months both gyms have cost 85 dollars." },
          ],
        },
        {
          kind: "plot",
          x: [0, 7],
          y: [0, 200],
          curves: [
            { expr: "40 + 15x", label: md`\text{Gym A: } C = 40 + 15m`, color: 1 },
            { expr: "10 + 25x", label: md`\text{Gym B: } C = 10 + 25m`, color: 2 },
          ],
          points: [{ x: 3, y: 85, label: "(3, 85)", color: 3 }],
          caption: "Months across, total cost up. Before 3 months Gym B is cheaper; after that Gym A is. The crossing point is where they swap.",
        },
        {
          kind: "example",
          title: "With and against a current",
          problem: md`A boat goes 36 km downstream in 2 hours and comes back upstream in 3 hours. Find the boat's speed in still water and the speed of the current.`,
          steps: [
            { math: md`b + c = \frac{36}{2} = 18`, note: md`Let $b$ = boat speed, $c$ = current speed, in km per hour. Downstream the current helps, so the speeds add. Speed = distance ÷ time.` },
            { math: md`b - c = \frac{36}{3} = 12`, note: "Upstream the current works against the boat." },
            { math: md`2b = 30 \Rightarrow b = 15`, note: md`Add the equations: $c$ cancels.` },
            { math: md`c = 18 - 15 = 3`, note: "Back into the first equation." },
            { math: md`(15 + 3) \cdot 2 = 36 \;\checkmark \quad (15 - 3) \cdot 3 = 36 \;\checkmark`, note: "Check against the story: both trips really are 36 km." },
          ],
        },
        {
          kind: "why",
          title: "Why check against the story, not the equations?",
          body: md`Plugging the answer into your own equations only shows that you solved them correctly. It can't show that you wrote the right equations.

Suppose in the ticket problem you mixed up the prices and wrote $5a + 8s = 142$. Solving gives $a = 14$, $s = 9$, which fits your equations perfectly. But 14 adult tickets at 8 dollars plus 9 student tickets at 5 dollars is $112 + 45 = 157$ dollars, not 142. Only the story catches the mistake.`,
        },
        {
          kind: "check",
          prompt: md`A farm has chickens and cows: 30 heads and 74 legs in all. How many chickens and how many cows are there? Answer as (chickens, cows).`,
          answer: "(23, 7)",
          form: "tuple",
          explain: md`$c + w = 30$ and $2c + 4w = 74$. Substitute $c = 30 - w$: $60 - 2w + 4w = 74$, so $2w = 14$ and $w = 7$. Then $c = 23$. Check: $46 + 28 = 74$ legs ✓.`,
        },
        {
          kind: "check",
          prompt: md`Two numbers add up to 52. The larger is 14 more than the smaller. Find both. Answer as (larger, smaller).`,
          answer: "(33, 19)",
          form: "tuple",
          explain: md`$x + y = 52$ and $x - y = 14$. Adding gives $2x = 66$, so $x = 33$ and $y = 19$.`,
        },
      ],
      practice: [countAndValue, ratesAndComparisons],
    },
  ],
};
