// A small expression language for typed answers: parse what a learner types
// ("2x + 3", "-(x-1)/4", "sqrt(2)", "x = 7"), evaluate it, and render it as
// LaTeX. Implicit multiplication ("3x", "2(x+1)", "xy") is supported because
// that is how people write algebra by hand. Also: log bases ("log_2(8)"),
// factorials ("5!"), and complex evaluation where i is the imaginary unit.

export type BinOp = "+" | "-" | "*" | "/" | "^";
export type FnName = "sqrt" | "abs" | "sin" | "cos" | "tan" | "asin" | "acos" | "atan" | "ln" | "log" | "exp" | "fact";

export type Node =
  | { type: "num"; value: number; text: string }
  | { type: "var"; name: string }
  | { type: "neg"; arg: Node }
  | { type: "bin"; op: BinOp; left: Node; right: Node; implicit?: boolean }
  /** `base` is only used by log: log_b(x). Without it log is base 10. */
  | { type: "call"; fn: FnName; arg: Node; base?: Node };

export class ParseError extends Error {}

type Token =
  | { kind: "num"; value: number; text: string }
  | { kind: "var"; name: string }
  | { kind: "fn"; name: FnName }
  | { kind: "op"; op: "+" | "-" | "*" | "/" | "^" | "(" | ")" | "|" | "=" | "_" | "!" };

// "fact" is produced by a postfix "!", never typed by name.
const FUNCTIONS: FnName[] = ["sqrt", "abs", "asin", "acos", "atan", "sin", "cos", "tan", "ln", "log", "exp"];
// Longest names first so "sqrt" wins over "s", "q", ... and "pi" over "p", "i".
const NAMES = [...FUNCTIONS, "pi"].sort((a, b) => b.length - a.length);

const SYMBOLS: Record<string, string> = {
  "×": "*",
  "·": "*",
  "⋅": "*",
  "÷": "/",
  "−": "-",
  "–": "-",
  π: "pi",
  "√": "sqrt",
  "²": "^2",
  "³": "^3",
  // Angles are answered in degrees; the symbol is optional.
  "°": "",
};

export function tokenize(source: string): Token[] {
  let src = source;
  for (const [sym, rep] of Object.entries(SYMBOLS)) src = src.split(sym).join(rep);
  src = src.replace(/\*\*/g, "^");

  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
    if (num) {
      tokens.push({ kind: "num", value: Number(num[1]), text: num[1]! });
      i += num[1]!.length;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      const word = /^[a-zA-Z]+/.exec(src.slice(i))![0];
      // Split a run of letters into known names and single-letter variables:
      // "sqrtx" -> sqrt x, "xy" -> x y, "2pir" -> 2 pi r.
      let j = 0;
      while (j < word.length) {
        const rest = word.slice(j).toLowerCase();
        const name = NAMES.find((n) => rest.startsWith(n));
        if (name === "pi") {
          tokens.push({ kind: "num", value: Math.PI, text: "pi" });
          j += 2;
        } else if (name) {
          tokens.push({ kind: "fn", name: name as FnName });
          j += name.length;
        } else {
          tokens.push({ kind: "var", name: word[j]! });
          j++;
        }
      }
      i += word.length;
      continue;
    }
    if ("+-*/^()|=_!".includes(ch)) {
      tokens.push({ kind: "op", op: ch as "+" });
      i++;
      continue;
    }
    if (ch === "[" || ch === "{") {
      tokens.push({ kind: "op", op: "(" });
      i++;
      continue;
    }
    if (ch === "]" || ch === "}") {
      tokens.push({ kind: "op", op: ")" });
      i++;
      continue;
    }
    throw new ParseError(`I don't understand the symbol "${ch}".`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  // Inside |...| a bare "|" closes the bar instead of opening a new one.
  private absDepth = 0;

  constructor(private tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private isOp(op: string): boolean {
    const t = this.peek();
    return t?.kind === "op" && t.op === op;
  }

  private expect(op: string) {
    if (!this.isOp(op)) throw new ParseError(op === ")" ? "A bracket is missing a closing \")\"." : `Expected "${op}".`);
    this.pos++;
  }

  parseAll(): Node {
    if (this.tokens.length === 0) throw new ParseError("Type an answer first.");
    const node = this.expr();
    if (this.pos < this.tokens.length) {
      const t = this.peek()!;
      if (t.kind === "op" && t.op === ")") throw new ParseError('There is an extra ")".');
      throw new ParseError("Something after the answer doesn't fit.");
    }
    return node;
  }

  parseEquation(): [Node, Node] {
    const left = this.expr();
    this.expect("=");
    const right = this.expr();
    if (this.pos < this.tokens.length) throw new ParseError("An equation should have exactly one \"=\".");
    return [left, right];
  }

  private expr(): Node {
    let left = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.tokens[this.pos++] as { op: BinOp }).op;
      left = { type: "bin", op, left, right: this.term() };
    }
    return left;
  }

  private startsPrimary(): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.kind !== "op") return true;
    return t.op === "(" || (t.op === "|" && this.absDepth === 0);
  }

  private term(): Node {
    let left = this.unary();
    for (;;) {
      if (this.isOp("*") || this.isOp("/")) {
        const op = (this.tokens[this.pos++] as { op: BinOp }).op;
        left = { type: "bin", op, left, right: this.unary() };
      } else if (this.startsPrimary()) {
        left = { type: "bin", op: "*", left, right: this.power(), implicit: true };
      } else {
        return left;
      }
    }
  }

  private unary(): Node {
    if (this.isOp("-")) {
      this.pos++;
      return { type: "neg", arg: this.unary() };
    }
    if (this.isOp("+")) {
      this.pos++;
      return this.unary();
    }
    return this.power();
  }

  private power(): Node {
    let base = this.primary();
    while (this.isOp("!")) {
      this.pos++;
      base = { type: "call", fn: "fact", arg: base };
    }
    if (this.isOp("^")) {
      this.pos++;
      // Right-associative, and the exponent may carry its own sign: 2^-1.
      return { type: "bin", op: "^", left: base, right: this.unary() };
    }
    return base;
  }

  private primary(): Node {
    const t = this.peek();
    if (!t) throw new ParseError("The answer ends too early.");
    this.pos++;
    if (t.kind === "num") return { type: "num", value: t.value, text: t.text };
    if (t.kind === "var") return { type: "var", name: t.name };
    if (t.kind === "fn") {
      if (t.name === "log" && this.isOp("_")) {
        this.pos++;
        const base = this.primary();
        if (!this.startsPrimary()) throw new ParseError("log needs something to act on, like log_2(8).");
        return { type: "call", fn: "log", base, arg: this.power() };
      }
      if (!this.startsPrimary() && !this.isOp("-")) throw new ParseError(`${t.name} needs something to act on.`);
      return { type: "call", fn: t.name, arg: this.isOp("-") ? this.unary() : this.power() };
    }
    if (t.op === "(") {
      const inner = this.expr();
      this.expect(")");
      return inner;
    }
    if (t.op === "|") {
      this.absDepth++;
      const inner = this.expr();
      this.absDepth--;
      this.expect("|");
      return { type: "call", fn: "abs", arg: inner };
    }
    throw new ParseError(`"${t.op}" can't go there.`);
  }
}

export function parse(source: string): Node {
  return new Parser(tokenize(source)).parseAll();
}

export function parseEquation(source: string): [Node, Node] {
  return new Parser(tokenize(source)).parseEquation();
}

/** Like Math.pow, but odd roots of negatives are real: (-8)^(1/3) = -2, as on paper. */
function realPow(a: number, b: number): number {
  const r = Math.pow(a, b);
  if (!Number.isNaN(r) || a >= 0) return r;
  for (let q = 3; q <= 15; q += 2) {
    const p = Math.round(b * q);
    if (Math.abs(p / q - b) < 1e-12) return (p % 2 === 0 ? 1 : -1) * Math.pow(-a, b);
  }
  return r;
}

export function evaluate(node: Node, scope: Record<string, number> = {}): number {
  switch (node.type) {
    case "num":
      return node.value;
    case "var":
      if (node.name in scope) return scope[node.name]!;
      if (node.name === "e") return Math.E;
      return NaN;
    case "neg":
      return -evaluate(node.arg, scope);
    case "call": {
      const x = evaluate(node.arg, scope);
      switch (node.fn) {
        case "sqrt":
          return Math.sqrt(x);
        case "abs":
          return Math.abs(x);
        case "sin":
          return Math.sin(x);
        case "cos":
          return Math.cos(x);
        case "tan":
          return Math.tan(x);
        case "asin":
          return Math.asin(x);
        case "acos":
          return Math.acos(x);
        case "atan":
          return Math.atan(x);
        case "ln":
          return Math.log(x);
        case "log":
          return node.base ? Math.log(x) / Math.log(evaluate(node.base, scope)) : Math.log10(x);
        case "exp":
          return Math.exp(x);
        case "fact":
          return factorial(x);
      }
    }
    case "bin": {
      const a = evaluate(node.left, scope);
      const b = evaluate(node.right, scope);
      switch (node.op) {
        case "+":
          return a + b;
        case "-":
          return a - b;
        case "*":
          return a * b;
        case "/":
          return a / b;
        case "^":
          return realPow(a, b);
      }
    }
  }
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) return NaN;
  let f = 1;
  for (let k = 2; k <= n; k++) f *= k;
  return f;
}

// ── Complex evaluation ──────────────────────────────────────────────────────

export type Complex = [re: number, im: number];

const cmul = ([a, b]: Complex, [c, d]: Complex): Complex => [a * c - b * d, a * d + b * c];
const cdiv = ([a, b]: Complex, [c, d]: Complex): Complex => {
  const den = c * c + d * d;
  return [(a * c + b * d) / den, (b * c - a * d) / den];
};
const cexp = ([a, b]: Complex): Complex => [Math.exp(a) * Math.cos(b), Math.exp(a) * Math.sin(b)];
const clog = ([a, b]: Complex): Complex => [Math.log(Math.hypot(a, b)), Math.atan2(b, a)];

function cpow(z: Complex, w: Complex): Complex {
  // Integer powers by repeated multiplication, so (1 + i)^2 is exactly 2i.
  if (w[1] === 0 && Number.isInteger(w[0]) && Math.abs(w[0]) <= 64) {
    let r: Complex = [1, 0];
    for (let k = 0; k < Math.abs(w[0]); k++) r = cmul(r, z);
    return w[0] < 0 ? cdiv([1, 0], r) : r;
  }
  if (z[0] === 0 && z[1] === 0) return [0, 0];
  return cexp(cmul(w, clog(z)));
}

/** Evaluate with complex arithmetic: `i` is the imaginary unit unless the scope defines it. */
export function evaluateComplex(node: Node, scope: Record<string, number> = {}): Complex {
  switch (node.type) {
    case "num":
      return [node.value, 0];
    case "var":
      if (node.name in scope) return [scope[node.name]!, 0];
      if (node.name === "i") return [0, 1];
      if (node.name === "e") return [Math.E, 0];
      return [NaN, NaN];
    case "neg": {
      const [a, b] = evaluateComplex(node.arg, scope);
      return [-a, -b];
    }
    case "call": {
      const z = evaluateComplex(node.arg, scope);
      switch (node.fn) {
        case "sqrt": {
          // Principal root: sqrt(-4) = 2i.
          const r = Math.hypot(z[0], z[1]);
          const re = Math.sqrt((r + z[0]) / 2);
          const im = Math.sign(z[1] || 1) * Math.sqrt((r - z[0]) / 2);
          return [re, im];
        }
        case "abs":
          return [Math.hypot(z[0], z[1]), 0];
        case "exp":
          return cexp(z);
        case "ln":
          return clog(z);
        case "log": {
          const base = node.base ? clog(evaluateComplex(node.base, scope)) : [Math.LN10, 0] as Complex;
          return cdiv(clog(z), base);
        }
        default:
          // Real-only functions: fine for real arguments.
          return z[1] === 0 ? [evaluate({ ...node, arg: { type: "num", value: z[0], text: String(z[0]) } }, scope), 0] : [NaN, NaN];
      }
    }
    case "bin": {
      const a = evaluateComplex(node.left, scope);
      const b = evaluateComplex(node.right, scope);
      switch (node.op) {
        case "+":
          return [a[0] + b[0], a[1] + b[1]];
        case "-":
          return [a[0] - b[0], a[1] - b[1]];
        case "*":
          return cmul(a, b);
        case "/":
          return cdiv(a, b);
        case "^":
          return cpow(a, b);
      }
    }
  }
}

export function variables(node: Node, into = new Set<string>()): Set<string> {
  if (node.type === "var") into.add(node.name);
  else if (node.type === "neg") variables(node.arg, into);
  else if (node.type === "call") {
    variables(node.arg, into);
    if (node.base) variables(node.base, into);
  } else if (node.type === "bin") {
    variables(node.left, into);
    variables(node.right, into);
  }
  return into;
}

/** Number of numbers and variables written: a rough measure of how simplified an answer is. */
export function leafCount(node: Node): number {
  if (node.type === "num" || node.type === "var") return 1;
  if (node.type === "neg" || node.type === "call") return leafCount(node.arg);
  return leafCount(node.left) + leafCount(node.right);
}

/** Every literal fraction a/b written in the answer, e.g. "6/8" -> [[6, 8]]. */
export function literalFractions(node: Node, into: [number, number][] = []): [number, number][] {
  if (node.type === "bin") {
    const top = node.left.type === "neg" ? node.left.arg : node.left;
    if (node.op === "/" && top.type === "num" && node.right.type === "num") into.push([top.value, node.right.value]);
    literalFractions(node.left, into);
    literalFractions(node.right, into);
  } else if (node.type === "neg" || node.type === "call") literalFractions(node.arg, into);
  return into;
}

const PREC = { "+": 1, "-": 1, "*": 2, "/": 2, neg: 2, "^": 4, atom: 5 } as const;

function prec(node: Node): number {
  if (node.type === "bin") return node.op === "/" ? PREC.atom : PREC[node.op];
  if (node.type === "neg") return PREC.neg;
  return PREC.atom;
}

function wrap(latex: string, needed: boolean): string {
  return needed ? `\\left(${latex}\\right)` : latex;
}

function startsWithDigit(node: Node): boolean {
  if (node.type === "num") return node.text !== "pi";
  if (node.type === "bin") return node.op !== "/" && startsWithDigit(node.left);
  return false;
}

export function toLatex(node: Node): string {
  switch (node.type) {
    case "num":
      return node.text === "pi" ? "\\pi" : node.text;
    case "var":
      return node.name;
    case "neg":
      return `-${wrap(toLatex(node.arg), prec(node.arg) <= PREC["+"] || node.arg.type === "neg")}`;
    case "call": {
      const arg = toLatex(node.arg);
      if (node.fn === "sqrt") return `\\sqrt{${arg}}`;
      if (node.fn === "abs") return `\\left|${arg}\\right|`;
      if (node.fn === "exp") return `e^{${arg}}`;
      if (node.fn === "fact") return `${wrap(arg, prec(node.arg) < PREC.atom || node.arg.type === "call")}!`;
      if (node.fn === "log" && node.base) return `\\log_{${toLatex(node.base)}}${wrap(arg, true)}`;
      const name = { asin: "arcsin", acos: "arccos", atan: "arctan" }[node.fn as string] ?? node.fn;
      return `\\${name}${wrap(arg, true)}`;
    }
    case "bin": {
      const { op, left, right } = node;
      if (op === "/") return `\\frac{${toLatex(left)}}{${toLatex(right)}}`;
      if (op === "^") return `${wrap(toLatex(left), prec(left) < PREC.atom || left.type === "num" && left.value < 0)}^{${toLatex(right)}}`;
      const l = wrap(toLatex(left), prec(left) < PREC[op]);
      const rNeedsParens = prec(right) < PREC[op] || (op === "-" && prec(right) === PREC["-"]) || right.type === "neg";
      const r = wrap(toLatex(right), rNeedsParens);
      if (op === "*") {
        // Juxtapose like handwriting ("3x", "2(x+1)") unless two numbers would run together.
        return startsWithDigit(right) && !rNeedsParens ? `${l} \\cdot ${r}` : `${l}${r}`;
      }
      return `${l} ${op} ${r}`;
    }
  }
}
