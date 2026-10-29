// Decides whether a typed answer matches the expected one. Two expressions are
// treated as equal when they agree at many sample points, so "2(x+1)",
// "2x+2" and "x+x+2" are all the same answer. Lessons that ask for a
// simplified form can additionally reject answers that are equal but longer.

import { evaluate, leafCount, literalFractions, parse, parseEquation, ParseError, variables, type Node } from "./expr";
import { gcd } from "./random";

export interface AnswerSpec {
  /** The expected answer as an expression, e.g. "3/4", "2x - 5", "(c - a x)/b". Omit for text-only answers. */
  answer?: string;
  /** Plain-language answers also accepted, e.g. ["no solution"]. */
  accept?: string[];
  /** Require the answer in simplest form (no un-combined terms, reduced fractions). */
  simplified?: boolean;
  /** Require no products of sums left unmultiplied, e.g. reject "-(x - 3)" for "-x + 3". */
  expanded?: boolean;
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
export function compare(a: Node, b: Node): "equal" | "close" | "different" {
  const names = [...new Set([...variables(a), ...variables(b)])].filter((n) => n !== "e");
  let valid = 0;
  // Mixed-sign samples first, then positive-only ones so sqrt(x) and ln(x) get checked too.
  for (let i = 0; i < SAMPLES.length * 2; i++) {
    const scope: Record<string, number> = {};
    names.forEach((name, k) => {
      const v = SAMPLES[(i + k * 5) % SAMPLES.length]!;
      scope[name] = i >= SAMPLES.length ? Math.abs(v) : v;
    });
    const x = evaluate(a, scope);
    const y = evaluate(b, scope);
    const xFinite = Number.isFinite(x);
    const yFinite = Number.isFinite(y);
    if (!xFinite && !yFinite) continue;
    if (xFinite !== yFinite) return "different";
    valid++;
    const diff = Math.abs(x - y);
    const scale = Math.max(1, Math.abs(x), Math.abs(y));
    if (diff > 1e-9 * scale) {
      // A plain number that is nearly right is a rounded decimal; an expression that is nearly right is just wrong.
      return names.length === 0 && diff <= 5e-3 * scale ? "close" : "different";
    }
  }
  return valid > 0 ? "equal" : "different";
}

function isSum(node: Node): boolean {
  return node.type === "bin" && (node.op === "+" || node.op === "-");
}

function hasUnexpandedProduct(node: Node): boolean {
  if (node.type === "neg") return isSum(node.arg) || hasUnexpandedProduct(node.arg);
  if (node.type === "call") return hasUnexpandedProduct(node.arg);
  if (node.type !== "bin") return false;
  if (node.op === "*" && (isSum(node.left) || isSum(node.right))) return true;
  return hasUnexpandedProduct(node.left) || hasUnexpandedProduct(node.right);
}

/** Read "x = 4" or "4 = x" as the value 4; anything else is left as typed. */
function stripAssignment(input: string): Node {
  if (!input.includes("=")) return parse(input);
  const [left, right] = parseEquation(input);
  if (left.type === "var") return right;
  if (right.type === "var") return left;
  throw new ParseError("Give the value on its own, like x = 4 or just 4.");
}

export function checkAnswer(input: string, spec: AnswerSpec): Verdict {
  const trimmed = input.trim();
  if (!trimmed) return { status: "invalid", message: "Type an answer first." };

  if (spec.accept?.some((a) => normalizeText(a) === normalizeText(trimmed))) return { status: "correct" };

  // Words with spaces ("all real numbers") are an attempt at a text answer, not algebra.
  if (spec.answer === undefined || /^[a-zA-Z]+(\s+[a-zA-Z]+)+$/.test(trimmed)) return { status: "incorrect" };

  let given: Node;
  try {
    given = stripAssignment(trimmed);
  } catch (err) {
    return { status: "invalid", message: err instanceof ParseError ? err.message : "I couldn't read that answer." };
  }

  const expected = parse(spec.answer);
  const result = compare(given, expected);
  if (result === "close") {
    return { status: "incorrect", message: "That's a rounded decimal. Give the exact value, e.g. a fraction like 1/3." };
  }
  if (result === "different") return { status: "incorrect" };

  if (spec.expanded && hasUnexpandedProduct(given)) {
    return { status: "unsimplified", message: "That's equal to the answer, but multiply out the parentheses." };
  }
  if (spec.simplified) {
    const unreduced = literalFractions(given).find(([n, d]) => Number.isInteger(n) && Number.isInteger(d) && gcd(n, d) > 1);
    if (unreduced) {
      return { status: "unsimplified", message: `Right value, but ${unreduced[0]}/${unreduced[1]} can be reduced.` };
    }
    if (leafCount(given) > leafCount(expected)) {
      return { status: "unsimplified", message: "That's equal to the answer, but it can be simplified further." };
    }
  }
  return { status: "correct" };
}
