// Decides whether a typed answer matches the expected one. Two expressions are
// treated as equal when they agree at many sample points, so "2(x+1)",
// "2x+2" and "x+x+2" are all the same answer. Lessons that ask for a
// particular form (simplified, expanded, factored) can additionally reject
// answers that are equal but not in that form.
//
// Besides single expressions, answers can be ordered tuples "(2, -3)",
// unordered solution lists "x = 2 or x = -3", and inequalities "-1 < x <= 4"
// (or interval notation "(-1, 4]").

import { evaluate, evaluateComplex, leafCount, literalFractions, parse, parseEquation, ParseError, variables, type Node } from "./expr";
import { gcd } from "./random";

export type AnswerForm = "expr" | "tuple" | "set" | "inequality";

export interface AnswerSpec {
  /** The expected answer, written in the syntax of `form`, e.g. "3/4", "(2, -3)", "2, -3", "x >= 4". Omit for text-only answers. */
  answer?: string;
  /** How the answer is read. Default "expr", a single expression. */
  form?: AnswerForm;
  /** Plain-language answers also accepted, e.g. ["no solution"]. */
  accept?: string[];
  /** Require simplest form: no un-combined terms, reduced fractions, simplified radicals, no radicals in denominators. */
  simplified?: boolean;
  /** Require no products of sums left unmultiplied, e.g. reject "-(x - 3)" for "-x + 3". */
  expanded?: boolean;
  /** Require a product of factors, e.g. "(x - 2)(x + 3)" rather than "x^2 + x - 6". */
  factored?: boolean;
  /** Reject negative exponents, e.g. "x^-3" when "1/x^3" is wanted. */
  positiveExponents?: boolean;
  /**
   * Multiple choice: the learner picks one of these instead of typing. Put the
   * correct option in `accept` (and leave `answer` unset).
   */
  choices?: string[];
  /**
   * Complex numbers: `i` is the imaginary unit (i^2 = -1) instead of a variable.
   * With `simplified`, answers must be in a + bi form (no i in a denominator, no i^2).
   */
  complex?: boolean;
  /** The prompt says the variables are positive, so only positive values are compared: log(x^2) = 2log(x). */
  positive?: boolean;
}

export type Verdict =
  | { status: "correct" }
  | { status: "unsimplified"; message: string }
  | { status: "incorrect"; message?: string }
  | { status: "invalid"; message: string };

const SAMPLES = [0.37, -1.62, 2.71, -0.83, 1.19, 3.47, -2.38, 0.59, 4.13, -3.06, 1.88, -0.41];

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Compare two expressions numerically. Returns "equal", "close" (equal to about
 * three significant figures, i.e. a rounded decimal) or "different".
 */
export function compare(a: Node, b: Node, complex = false, positive = false): "equal" | "close" | "different" {
  const names = [...new Set([...variables(a), ...variables(b)])].filter((n) => n !== "e" && !(complex && n === "i"));
  let valid = 0;
  // Mixed-sign samples first, then positive-only ones so sqrt(x) and ln(x) get checked too.
  for (let i = positive ? SAMPLES.length : 0; i < SAMPLES.length * 2; i++) {
    const scope: Record<string, number> = {};
    names.forEach((name, k) => {
      const v = SAMPLES[(i + k * 5) % SAMPLES.length]!;
      scope[name] = i >= SAMPLES.length ? Math.abs(v) : v;
    });
    const [xr, xi] = complex ? evaluateComplex(a, scope) : [evaluate(a, scope), 0];
    const [yr, yi] = complex ? evaluateComplex(b, scope) : [evaluate(b, scope), 0];
    const xFinite = Number.isFinite(xr) && Number.isFinite(xi);
    const yFinite = Number.isFinite(yr) && Number.isFinite(yi);
    if (!xFinite && !yFinite) continue;
    if (xFinite !== yFinite) return "different";
    valid++;
    const diff = Math.hypot(xr - yr, xi - yi);
    const scale = Math.max(1, Math.hypot(xr, xi), Math.hypot(yr, yi));
    if (diff > 1e-9 * scale) {
      // A plain number that is nearly right is a rounded decimal; an expression that is nearly right is just wrong.
      return names.length === 0 && diff <= 5e-3 * scale ? "close" : "different";
    }
  }
  return valid > 0 ? "equal" : "different";
}

const isSum = (node: Node) => node.type === "bin" && (node.op === "+" || node.op === "-");

function hasUnexpandedProduct(node: Node): boolean {
  if (node.type === "neg") return isSum(node.arg) || hasUnexpandedProduct(node.arg);
  if (node.type === "call") return hasUnexpandedProduct(node.arg);
  if (node.type !== "bin") return false;
  if (node.op === "*" && (isSum(node.left) || isSum(node.right))) return true;
  if (node.op === "^" && isSum(node.left)) return true;
  return hasUnexpandedProduct(node.left) || hasUnexpandedProduct(node.right);
}

/** A product (or power) at the top level, with at least one factor containing a variable. */
function isFactored(node: Node): boolean {
  if (node.type === "neg") return isFactored(node.arg);
  if (node.type !== "bin") return false;
  if (node.op === "^") return isSum(node.left);
  return node.op === "*" && variables(node).size > 0;
}

/** The factors of a product: -(a)(b)^2 -> [a, b]. */
function factorsOf(node: Node): Node[] {
  if (node.type === "neg") return factorsOf(node.arg);
  if (node.type === "bin" && node.op === "*") return [...factorsOf(node.left), ...factorsOf(node.right)];
  if (node.type === "bin" && node.op === "^" && variables(node.right).size === 0) return factorsOf(node.left);
  return [node];
}

/** Integer coefficients [a0, a1, ...] of a one-variable polynomial of degree <= 6, or null if it isn't one. */
function integerCoefficients(node: Node, name: string): number[] | null {
  const N = 7;
  const xs = Array.from({ length: N }, (_, i) => i - 3);
  // Solve the Vandermonde system by Gaussian elimination.
  const rows = xs.map((x) => [...Array.from({ length: N }, (_, k) => x ** k), evaluate(node, { [name]: x })]);
  for (let c = 0; c < N; c++) {
    const pivot = rows.slice(c).reduce((best, r, i) => (Math.abs(r[c]!) > Math.abs(rows[best]![c]!) ? i + c : best), c);
    [rows[c], rows[pivot]] = [rows[pivot]!, rows[c]!];
    for (let r = 0; r < N; r++) {
      if (r === c) continue;
      const f = rows[r]![c]! / rows[c]![c]!;
      for (let k = c; k <= N; k++) rows[r]![k]! -= f * rows[c]![k]!;
    }
  }
  const coeffs = rows.map((r, i) => r[N]! / r[i]!);
  if (coeffs.some((c) => !Number.isFinite(c) || Math.abs(c - Math.round(c)) > 1e-6)) return null;
  const rounded = coeffs.map(Math.round);
  // Confirm it's really this polynomial and not something else that happens to fit 7 points.
  for (const x of [5, -7, 0.5]) {
    const p = rounded.reduce((sum, c, k) => sum + c * x ** k, 0);
    if (Math.abs(p - evaluate(node, { [name]: x })) > 1e-6 * Math.max(1, Math.abs(p))) return null;
  }
  while (rounded.length > 1 && rounded[rounded.length - 1] === 0) rounded.pop();
  return rounded;
}

function divisors(n: number): number[] {
  n = Math.abs(n);
  const out: number[] = [];
  for (let d = 1; d <= n; d++) if (n % d === 0) out.push(d);
  return out;
}

/** Why a factorization over the integers isn't complete, or null if it is. */
function incompleteFactor(node: Node): string | null {
  for (const f of factorsOf(node)) {
    const names = [...variables(f)];
    if (!isSum(f) || names.length !== 1) continue;
    const c = integerCoefficients(f, names[0]!);
    if (!c || c.length < 2) continue;
    const content = c.reduce((g, v) => gcd(g, v), 0);
    if (content > 1) return `a factor still has a common factor of ${content}.`;
    const degree = c.length - 1;
    if (degree < 2) continue;
    const [a0, an] = [c[0]!, c[degree]!];
    if (a0 === 0) return `a factor still has a common factor of ${names[0]}.`;
    for (const p of divisors(a0)) {
      for (const q of divisors(an)) {
        for (const r of [p / q, -p / q]) {
          if (Math.abs(c.reduce((sum, v, k) => sum + v * r ** k, 0)) < 1e-9) return "one of the factors can still be factored.";
        }
      }
    }
  }
  return null;
}

function symbolic(node: Node): boolean {
  if (node.type === "num") return node.text === "pi";
  if (node.type === "var") return true;
  if (node.type === "neg" || node.type === "call") return symbolic(node.arg);
  return symbolic(node.left) || symbolic(node.right);
}

/** Arithmetic left undone in a numeric answer, like "3 + 4" or "2 * 5". */
function unevaluatedArithmetic(node: Node): boolean {
  // pi is a number to the parser, but "36pi" is a finished answer, not undone arithmetic.
  const lit = (n: Node): boolean => (n.type === "num" && n.text !== "pi") || (n.type === "neg" && lit(n.arg));
  // 1 - 1/6 is undone arithmetic too, though 1/6 alone is a finished fraction.
  const term = (n: Node): boolean => lit(n) || (n.type === "bin" && n.op === "/" && lit(n.left) && lit(n.right));
  // 9!/6! still has to be worked out.
  if (node.type === "call" && node.fn === "fact" && lit(node.arg)) return true;
  if (node.type === "neg" || node.type === "call") return unevaluatedArithmetic(node.arg);
  if (node.type !== "bin") return false;
  if ((node.op === "+" || node.op === "-" || node.op === "*") && term(node.left) && term(node.right)) return true;
  return unevaluatedArithmetic(node.left) || unevaluatedArithmetic(node.right);
}

/** A fraction whose numerator terms and denominator share a factor: (6 + 2sqrt(5))/4. */
function reducibleFraction(node: Node): number | null {
  if (node.type === "neg" || node.type === "call") return reducibleFraction(node.arg);
  if (node.type !== "bin") return null;
  if (node.op === "/" && node.right.type === "num" && Number.isInteger(node.right.value) && node.right.value > 1) {
    const terms: Node[] = [];
    const collect = (n: Node): void => {
      if (isSum(n) && n.type === "bin") {
        collect(n.left);
        collect(n.right);
      } else terms.push(n);
    };
    collect(node.left);
    const coef = (t: Node): number => {
      if (t.type === "neg") return coef(t.arg);
      if (t.type === "num") return Number.isInteger(t.value) ? t.value : 1;
      if (t.type === "bin" && t.op === "*" && t.left.type === "num" && Number.isInteger(t.left.value)) return t.left.value;
      return 1;
    };
    const g = terms.reduce((acc, t) => gcd(acc, coef(t)), node.right.value);
    if (g > 1) return g;
  }
  return reducibleFraction(node.left) ?? reducibleFraction(node.right);
}

function hasNegativeExponent(node: Node): boolean {
  if (node.type === "neg" || node.type === "call") return hasNegativeExponent(node.arg);
  if (node.type !== "bin") return false;
  if (node.op === "^" && variables(node.right).size === 0 && evaluate(node.right) < 0) return true;
  return hasNegativeExponent(node.left) || hasNegativeExponent(node.right);
}

function largestSquareFactor(n: number): number {
  let best = 1;
  for (let k = 2; k * k <= n; k++) if (n % (k * k) === 0) best = k;
  return best;
}

function radicalIssue(node: Node): string | null {
  if (node.type === "call") {
    if (node.fn === "sqrt" && node.arg.type === "num" && Number.isInteger(node.arg.value) && largestSquareFactor(node.arg.value) > 1) {
      const k = largestSquareFactor(node.arg.value);
      return `√${node.arg.value} can be simplified: ${node.arg.value} = ${k * k} · ${node.arg.value / (k * k)}.`;
    }
    return radicalIssue(node.arg);
  }
  if (node.type === "neg") return radicalIssue(node.arg);
  if (node.type !== "bin") return null;
  if (node.op === "/" && hasSqrt(node.right)) return "Rationalize the denominator: there shouldn't be a square root in it.";
  return radicalIssue(node.left) ?? radicalIssue(node.right);
}

function hasSqrt(node: Node): boolean {
  if (node.type === "call") return node.fn === "sqrt" || hasSqrt(node.arg);
  if (node.type === "neg") return hasSqrt(node.arg);
  if (node.type === "bin") {
    const fractionalPower = node.op === "^" && variables(node.right).size === 0 && evaluate(node.right) % 1 !== 0;
    return fractionalPower || hasSqrt(node.left) || hasSqrt(node.right);
  }
  return false;
}

/** Read "x = 4" or "4 = x" as the value 4; anything else is left as typed. */
function stripAssignment(input: string): Node {
  if (!input.includes("=")) return parse(input);
  const [left, right] = parseEquation(input);
  if (left.type === "var") return right;
  if (right.type === "var") return left;
  throw new ParseError("Give the value on its own, like x = 4 or just 4.");
}

/** Split on commas that aren't inside brackets. */
export function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (ch === "," && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts.map((p) => p.trim());
}

/** "(a, b)" -> "a, b" when the outer brackets enclose the whole list. */
function unwrapList(s: string): string {
  const t = s.trim();
  if (!/^[([{]/.test(t) || !/[)\]}]$/.test(t)) return t;
  const inner = t.slice(1, -1);
  let depth = 0;
  for (const ch of inner) {
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch) && --depth < 0) return t;
  }
  return splitTopLevel(inner).length > 1 || t[0] === "{" ? inner : t;
}

function hasI(node: Node): boolean {
  return variables(node).has("i");
}

/** Why a complex answer isn't in a + bi form, or null. */
function complexIssue(node: Node): string | null {
  if (node.type === "call" && node.fn === "sqrt" && variables(node.arg).size === 0 && evaluate(node.arg) < 0) {
    return "write the square root of a negative number with i: sqrt(-n) = i sqrt(n).";
  }
  if (node.type === "neg" || node.type === "call") return complexIssue(node.arg);
  if (node.type !== "bin") return null;
  if (node.op === "/" && hasI(node.right)) return "there shouldn't be an i in the denominator. Multiply by the conjugate.";
  if (node.op === "^" && hasI(node.left)) return "powers of i can be simplified (i^2 = -1).";
  if (node.op === "*" && hasI(node.left) && hasI(node.right)) return "i times i is -1, so that product can be simplified.";
  return complexIssue(node.left) ?? complexIssue(node.right);
}

function formChecks(given: Node, expected: Node, spec: AnswerSpec): Verdict {
  if (spec.factored) {
    if (!isFactored(given)) return { status: "unsimplified", message: "That's equal to the answer, but it isn't factored. Write it as a product." };
    const why = incompleteFactor(given);
    if (why) return { status: "unsimplified", message: `Good start, but it isn't factored completely: ${why}` };
  }
  if (spec.expanded && hasUnexpandedProduct(given)) {
    return { status: "unsimplified", message: "That's equal to the answer, but multiply out the parentheses." };
  }
  if (spec.positiveExponents && hasNegativeExponent(given)) {
    return { status: "unsimplified", message: "Right value, but write it without negative exponents." };
  }
  if (spec.simplified && spec.complex) {
    const issue = complexIssue(given);
    if (issue) return { status: "unsimplified", message: `Right value, but ${issue}` };
  }
  if (spec.simplified) {
    const unreduced = literalFractions(given).find(([n, d]) => Number.isInteger(n) && Number.isInteger(d) && gcd(n, d) > 1);
    if (unreduced) return { status: "unsimplified", message: `Right value, but ${unreduced[0]}/${unreduced[1]} can be reduced.` };
    const radical = radicalIssue(given);
    if (radical) return { status: "unsimplified", message: `Right value, but ${radical[0]!.toLowerCase()}${radical.slice(1)}` };
    const g = reducibleFraction(given);
    if (g) return { status: "unsimplified", message: `Right value, but the fraction can be reduced: everything divides by ${g}.` };
    // With variables, more symbols than the key means un-combined terms. Plain numbers have several
    // standard forms ((1 + sqrt(5))/2 and 1/2 + sqrt(5)/2), so only undone arithmetic is rejected.
    // pi behaves like a variable here: 12pi + 12pi has un-combined like terms.
    const numeric = !symbolic(given) && !symbolic(expected);
    if (numeric ? unevaluatedArithmetic(given) : leafCount(given) > leafCount(expected)) {
      return { status: "unsimplified", message: "That's equal to the answer, but it can be simplified further." };
    }
  }
  return { status: "correct" };
}

function checkExpr(input: string, expectedText: string, spec: AnswerSpec): Verdict {
  const given = stripAssignment(input);
  const expected = parse(expectedText);
  const result = compare(given, expected, spec.complex, spec.positive);
  if (result === "close") {
    return { status: "incorrect", message: "That's a rounded decimal. Give the exact value, e.g. a fraction like 1/3 or sqrt(2)." };
  }
  if (result === "different") return { status: "incorrect" };
  return formChecks(given, expected, spec);
}

function checkTuple(input: string, spec: AnswerSpec): Verdict {
  const expected = splitTopLevel(unwrapList(spec.answer!));
  const given = splitTopLevel(unwrapList(input));
  if (given.length !== expected.length) {
    return { status: "invalid", message: `The answer has ${expected.length} parts. Write it like (${expected.map((_, i) => "abc"[i] ?? "…").join(", ")}).` };
  }
  const verdicts = given.map((g, i) => checkExpr(g, expected[i]!, spec));
  if (verdicts.every((v) => v.status === "correct")) return { status: "correct" };
  if (expected.length === 2 && given.every((g, i) => checkExpr(g, expected[1 - i]!, { complex: spec.complex }).status === "correct")) {
    return { status: "incorrect", message: "Those are the right numbers in the wrong order. Write (x, y)." };
  }
  return verdicts.find((v) => v.status === "unsimplified") ?? { status: "incorrect" };
}

/** Split a list of solutions on commas and "or"/"and", expanding ± into two values. */
function solutionItems(text: string): string[] {
  const items = unwrapList(text)
    .split(/\s+(?:or|and)\s+/i)
    .flatMap(splitTopLevel)
    .filter(Boolean);
  return items.flatMap((item) => {
    const pm = item.replace(/\+\/-/g, "±");
    return pm.includes("±") ? [pm.replace("±", "+"), pm.replace("±", "-")] : [pm];
  });
}

function checkSet(input: string, spec: AnswerSpec): Verdict {
  const same = (a: Node, b: Node) => compare(a, b, spec.complex, spec.positive) === "equal";
  const dedupe = (nodes: Node[]) => nodes.filter((n, i) => nodes.findIndex((m) => same(m, n)) === i);
  const expected = dedupe(solutionItems(spec.answer!).map((s) => parse(s)));
  const given = dedupe(solutionItems(input).map(stripAssignment));
  const matched = given.filter((g) => expected.some((e) => same(g, e)));
  if (matched.length === expected.length && given.length === expected.length) {
    for (const g of given) {
      const e = expected.find((e) => same(g, e))!;
      const v = formChecks(g, e, spec);
      if (v.status !== "correct") return v;
    }
    return { status: "correct" };
  }
  if (matched.length === given.length) {
    return { status: "incorrect", message: `${given.length === 1 ? "That one is right" : "Those are right"}, but there ${expected.length === 1 ? "is" : "are"} ${expected.length} solution${expected.length === 1 ? "" : "s"}. Separate them with commas.` };
  }
  if (matched.length > 0) return { status: "incorrect", message: "Some of those are right, but not all of them are solutions." };
  return { status: "incorrect" };
}

// ── Inequalities ────────────────────────────────────────────────────────────

export interface Interval {
  lo: number;
  loOpen: boolean;
  hi: number;
  hiOpen: boolean;
}

const INEQ_HELP = "Write it like x > 3, -2 <= x < 5, x < 0 or x > 4, or in interval notation like (-inf, 3].";

function number(text: string): number {
  const t = text.trim().toLowerCase().replace(/\s+/g, "");
  if (/^\+?(inf|infinity|∞|oo)$/.test(t)) return Infinity;
  if (/^-(inf|infinity|∞|oo)$/.test(t)) return -Infinity;
  const node = parse(text);
  if (variables(node).size > 0) throw new ParseError(INEQ_HELP);
  return evaluate(node);
}

type Op = "<" | "<=" | ">" | ">=";
const FLIP: Record<Op, Op> = { "<": ">", "<=": ">=", ">": "<", ">=": "<=" };

/** One comparison chain, "x > 3" or "-2 <= x < 5", as an interval. */
function chainInterval(text: string): Interval {
  const pieces = text
    .replace(/≤|=</g, "<=")
    .replace(/≥|=>/g, ">=")
    .split(/(<=|>=|<|>)/)
    .map((p) => p.trim());
  const isVar = (s: string) => /^[a-zA-Z]$/.test(s);
  const bound = (op: Op, value: number): Interval =>
    op === "<" || op === "<="
      ? { lo: -Infinity, loOpen: true, hi: value, hiOpen: op === "<" }
      : { lo: value, loOpen: op === ">", hi: Infinity, hiOpen: true };

  if (pieces.length === 3) {
    const [a, op, b] = pieces as [string, Op, string];
    if (isVar(a)) return bound(op, number(b));
    if (isVar(b)) return bound(FLIP[op], number(a));
  }
  if (pieces.length === 5 && isVar(pieces[2]!)) {
    const [a, op1, , op2, b] = pieces as [string, Op, string, Op, string];
    const up = (op: Op) => op === "<" || op === "<=";
    if (up(op1) && up(op2)) return { lo: number(a), loOpen: op1 === "<", hi: number(b), hiOpen: op2 === "<" };
    if (!up(op1) && !up(op2)) return { lo: number(b), loOpen: op2 === ">", hi: number(a), hiOpen: op1 === ">" };
  }
  throw new ParseError(INEQ_HELP);
}

/** "(a, b]" style interval notation. */
function intervalNotation(text: string): Interval | null {
  const m = /^\s*([([])(.+),(.+)([)\]])\s*$/.exec(text);
  if (!m) return null;
  return { lo: number(m[2]!), loOpen: m[1] === "(", hi: number(m[3]!), hiOpen: m[4] === ")" };
}

function intersect(a: Interval, b: Interval): Interval {
  const lo = Math.max(a.lo, b.lo);
  const hi = Math.min(a.hi, b.hi);
  return {
    lo,
    loOpen: (a.lo === lo && a.loOpen) || (b.lo === lo && b.loOpen),
    hi,
    hiOpen: (a.hi === hi && a.hiOpen) || (b.hi === hi && b.hiOpen),
  };
}

export function parseInequality(text: string): Interval[] {
  return text
    .split(/\s+or\s+|∪|\s*\bU\b\s*/i)
    .map((part) =>
      part
        .split(/\s+and\s+|∩/i)
        .map((piece) => intervalNotation(piece) ?? chainInterval(piece))
        .reduce(intersect),
    )
    .sort((a, b) => a.lo - b.lo);
}

const sameNumber = (a: number, b: number) => a === b || Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a));

function checkInequality(input: string, spec: AnswerSpec): Verdict {
  const expected = parseInequality(spec.answer!);
  const given = parseInequality(input);
  const sameEnds = given.length === expected.length && given.every((g, i) => sameNumber(g.lo, expected[i]!.lo) && sameNumber(g.hi, expected[i]!.hi));
  if (sameEnds) {
    const sameOpen = given.every((g, i) => g.loOpen === expected[i]!.loOpen && g.hiOpen === expected[i]!.hiOpen);
    if (sameOpen) return { status: "correct" };
    return { status: "incorrect", message: "Right boundary, but check whether it's included: < versus ≤." };
  }
  const ends = (ivs: Interval[]) => ivs.flatMap((iv) => [iv.lo, iv.hi]).filter(Number.isFinite).sort((a, b) => a - b);
  const [ge, ee] = [ends(given), ends(expected)];
  if (ge.length === ee.length && ge.every((v, i) => sameNumber(v, ee[i]!))) {
    return { status: "incorrect", message: "Right boundary, but the inequality points the wrong way." };
  }
  return { status: "incorrect" };
}

export function checkAnswer(input: string, spec: AnswerSpec): Verdict {
  // "133 degrees" means 133; the ° symbol is already ignored by the parser.
  const trimmed = input.trim().replace(/\s*(?:degrees?|deg)\.?$/i, "");
  if (!trimmed) return { status: "invalid", message: "Type an answer first." };

  if (spec.accept?.some((a) => normalizeText(a) === normalizeText(trimmed))) return { status: "correct" };

  // Words with spaces ("all real numbers") are an attempt at a text answer, not algebra.
  if (spec.answer === undefined || /^[a-zA-Z]+(\s+[a-zA-Z]+)+$/.test(trimmed)) return { status: "incorrect" };

  try {
    switch (spec.form ?? "expr") {
      case "expr":
        return checkExpr(trimmed, spec.answer, spec);
      case "tuple":
        return checkTuple(trimmed, spec);
      case "set":
        return checkSet(trimmed, spec);
      case "inequality":
        return checkInequality(trimmed, spec);
    }
  } catch (err) {
    return { status: "invalid", message: err instanceof ParseError ? err.message : "I couldn't read that answer." };
  }
}
