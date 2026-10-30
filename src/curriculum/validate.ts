// Checks a unit of lesson content: every piece of LaTeX renders, every
// "Try it" check accepts its own answer, every graph expression parses, and
// every practice generator produces answer keys that are actually right.
// Used by the test suite and by scripts/check-unit.ts while writing a unit.

import katex from "katex";
import { checkAnswer, parseInequality, splitTopLevel } from "../math/check";
import { evaluate, evaluateComplex, parse, parseEquation, variables, type Node } from "../math/expr";
import { rng } from "../math/random";
import { isWritten, type Block, type ContourSpec, type DiagramSpec, type Figure, type PlotSpec, type Problem, type SurfaceSpec, type Unit } from "./types";
import type { AnswerSpec } from "../math/check";

/** Turn the LaTeX the generators emit back into typed-answer syntax. */
export function latexToText(tex: string): string {
  let s = tex
    .replace(/\\text\{[^}]*\}/g, "")
    .replace(/\\(?:left|right|big|Big)\b/g, "")
    .replace(/\\[,;:! ]|\\quad|\\qquad/g, " ")
    .replace(/\\(?:cdot|times)/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\(?:leq?|leqslant)\b/g, "<=")
    .replace(/\\(?:geq?|geqslant)\b/g, ">=")
    .replace(/\\lt\b/g, "<")
    .replace(/\\gt\b/g, ">")
    .replace(/\\pi\b/g, "pi")
    .replace(/\\theta\b/g, "t")
    .replace(/\\arc(sin|cos|tan)(?![a-zA-Z])/g, " a$1")
    // \sin^2 x means (sin x)^2.
    .replace(/\\(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|ln|log)\^\{?(-?\d+)\}?\s*(\([^()]*\)|[a-zA-Z0-9]+)/g, "(($1($3))^($2))")
    // No \b: "_" is a word character, so \log_{2} must still match.
    .replace(/\\(ln|log|sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|exp)(?![a-zA-Z])/g, " $1")
    .replace(/\\binom\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)!/(($2)!(($1)-($2))!))")
    .replace(/\\[lr]vert/g, "|")
    .replace(/\\(?:t|d)?frac/g, "\\frac");
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = s.replace(/\^\{([^{}]*)\}/g, "^($1)");
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)/($2))");
    s = s.replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, "(($2)^(1/($1)))");
    s = s.replace(/\\sqrt\{([^{}]*)\}/g, "sqrt($1)");
  }
  return s.replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, (c) => (c === "{" ? "(" : ")"));
}

const COMPARE = /(<=|>=|<|>)/;

function substitute(node: Node, name: string, value: Node): Node {
  switch (node.type) {
    case "var":
      return node.name === name ? value : node;
    case "num":
      return node;
    case "neg":
      return { ...node, arg: substitute(node.arg, name, value) };
    case "call":
      return { ...node, arg: substitute(node.arg, name, value), base: node.base && substitute(node.base, name, value) };
    case "bin":
      return { ...node, left: substitute(node.left, name, value), right: substitute(node.right, name, value) };
  }
}

function holds(pieces: string[], x: number, name: string): boolean {
  const values = pieces.filter((_, i) => i % 2 === 0).map((p) => evaluate(parse(p), { [name]: x }));
  for (let i = 1; i < pieces.length; i += 2) {
    const [a, b, op] = [values[(i - 1) / 2]!, values[(i + 1) / 2]!, pieces[i]!];
    // Tolerate rounding, e.g. 5(x - 3) >= 5x - 15 at a non-integer x.
    const eps = 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    const ok = op === "<" ? a < b - eps : op === "<=" ? a <= b + eps : op === ">" ? a > b + eps : a >= b - eps;
    if (!ok) return false;
  }
  return true;
}

/**
 * Independently check an answer key by reading the problem itself. Returns
 * true when the prompt had a recognisable shape and the key held up, false
 * when the shape isn't one it can read; throws when the key is wrong.
 */
export function verifyProblem(p: Problem): boolean {
  if (!p.answer) return false;
  if (p.verify?.length) return verifyHidden(p);
  const raw = [...p.prompt.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!);
  const calculus = verifyCalculus(p, raw);
  if (calculus !== null) return calculus;
  const math = raw.map(latexToText);
  const verb = p.prompt.match(/^(Solve|Evaluate|Expand|Simplify|Use|Compute|Factor|Multiply|Find the value of)\b/)?.[1];
  if (!verb || math.length === 0) return false;
  const form = p.form ?? "expr";
  const first = math[0]!;
  const fail = (why: string) => {
    throw new Error(`answer key "${p.answer}" is wrong: ${why}`);
  };

  if (verb === "Solve") {
    if (/ for \$/.test(p.prompt)) return false;
    if (form === "tuple") {
      const eqs = math.filter((m) => m.includes("=") && !COMPARE.test(m));
      if (eqs.length < 2) return false;
      const values = splitTopLevel(p.answer.replace(/^\s*\(|\)\s*$/g, "")).map((v) => evaluate(parse(v)));
      const names = [...new Set(eqs.flatMap((e) => [...variables(parse(e.split("=")[0]!)), ...variables(parse(e.split("=")[1]!))]))].sort();
      if (names.length !== values.length) return false;
      const scope = Object.fromEntries(names.map((n, i) => [n, values[i]!]));
      for (const e of eqs) {
        const [l, r] = e.split("=");
        const d = evaluate(parse(l!), scope) - evaluate(parse(r!), scope);
        if (Math.abs(d) > 1e-7) fail(`(${values.join(", ")}) doesn't satisfy ${e}`);
      }
      return true;
    }
    if (form === "inequality") {
      const pieces = first.split(COMPARE).map((s) => s.trim());
      if (pieces.length < 3) return false;
      const names = [...new Set(pieces.filter((_, i) => i % 2 === 0).flatMap((piece) => [...variables(parse(piece))]))];
      if (names.length !== 1) return false;
      const intervals = parseInequality(p.answer);
      const inside = (x: number) =>
        intervals.some((iv) => (iv.loOpen ? x > iv.lo : x >= iv.lo) && (iv.hiOpen ? x < iv.hi : x <= iv.hi));
      for (let x = -60; x <= 60; x += 0.137) {
        if (holds(pieces, x, names[0]!) !== inside(x)) fail(`at ${names[0]} = ${x.toFixed(3)} the inequality and the answer disagree`);
      }
      for (const iv of intervals) {
        for (const [end, open] of [[iv.lo, iv.loOpen], [iv.hi, iv.hiOpen]] as const) {
          if (Number.isFinite(end) && holds(pieces, end, names[0]!) === open) fail(`endpoint ${end} should be ${open ? "included" : "excluded"}`);
        }
      }
      return true;
    }
    if (!first.includes("=") || COMPARE.test(first)) return false;
    const [l, r] = first.split("=").map((side) => parse(side));
    const names = [...new Set([...variables(l!), ...variables(r!)])].filter((n) => !(p.complex && n === "i") && n !== "e");
    if (names.length !== 1) return false;
    const items = form === "set" ? splitTopLevel(p.answer).flatMap((s) => s.split(/\s+or\s+/)) : [p.answer];
    for (const item of items) {
      // Substitute the answer itself, so complex solutions like 2 - 3i can be checked too.
      const value = parse(item);
      const [a, b] = [evaluateComplex(substitute(l!, names[0]!, value)), evaluateComplex(substitute(r!, names[0]!, value))];
      const diff = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (!(diff <= 1e-7 * Math.max(1, Math.hypot(a[0], a[1])))) fail(`${names[0]} = ${item} gives ${a.join("+i")} = ${b.join("+i")}`);
    }
    return true;
  }

  if (form !== "expr") return false;
  if (verb === "Evaluate" || verb === "Use" || verb === "Compute" || verb === "Find the value of") {
    if (COMPARE.test(first) || first.includes("=")) return false;
    const scope: Record<string, number> = {};
    for (const m of math.slice(1)) {
      const [name, value] = m.split("=").map((s) => s.trim());
      if (!name || value === undefined || !/^[a-zA-Z]$/.test(name)) continue;
      scope[name] = evaluate(parse(value));
    }
    const node = parse(first);
    if ([...variables(node)].some((v) => !(v in scope) && v !== "e")) return false;
    const got = evaluate(node, scope);
    const want = evaluate(parse(p.answer), scope);
    if (!(Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(got)))) fail(`${first} evaluates to ${got}`);
    return true;
  }
  // Expand, Simplify, Factor, Multiply: the answer must equal the expression given.
  if (COMPARE.test(first) || first.includes("=")) return false;
  if (checkAnswer(first, { answer: p.answer, complex: p.complex, positive: p.positive }).status !== "correct") fail(`it isn't equal to ${first}`);
  return true;
}

/** Check the answer against the problem's hidden `verify` equations. */
function verifyHidden(p: Problem): boolean {
  const form = p.form ?? "expr";
  const values: Node[][] =
    form === "tuple"
      ? [splitTopLevel(p.answer!.replace(/^\s*\(|\)\s*$/g, "")).map((v) => parse(v))]
      : form === "set"
        ? splitTopLevel(p.answer!).map((v) => [parse(v)])
        : form === "expr"
          ? [[parse(p.answer!)]]
          : [];
  if (!values.length) throw new Error(`verify equations aren't supported for form "${form}"`);
  for (const eq of p.verify!) {
    const [l, r] = parseEquation(eq);
    const skip = (n: string) => (p.complex && n === "i") || n === "e";
    for (const vals of values) {
      // Letters the answer itself uses (x in "3x^2") stay free and are sampled: the equation must hold for every value.
      const free = new Set(vals.flatMap((v) => [...variables(v)]).filter((n) => !skip(n)));
      const names = [...new Set([...variables(l), ...variables(r)])].filter((n) => !skip(n) && !free.has(n)).sort();
      if (names.length !== vals.length) throw new Error(`verify equation "${eq}" has unknowns ${names.join(", ") || "(none)"} but the answer has ${vals.length} value(s)`);
      let [a, b] = [l, r];
      names.forEach((n, i) => {
        a = substitute(a, n, vals[i]!);
        b = substitute(b, n, vals[i]!);
      });
      const freeNames = [...free];
      const samples = freeNames.length ? SAMPLE_POINTS : [0];
      let checked = 0;
      for (const s of samples) {
        const scope = Object.fromEntries(freeNames.map((n, k) => [n, s + 0.37 * k]));
        const [x, y] = [evaluateComplex(a, scope), evaluateComplex(b, scope)];
        if (![x[0], x[1], y[0], y[1]].every(Number.isFinite)) continue;
        checked++;
        if (!(Math.hypot(x[0] - y[0], x[1] - y[1]) <= 1e-7 * Math.max(1, Math.hypot(x[0], x[1])))) {
          throw new Error(`answer key "${p.answer}" fails verify equation "${eq}"${freeNames.length ? ` at ${freeNames.map((n) => `${n} = ${scope[n]}`).join(", ")}` : ""}`);
        }
      }
      if (!checked) throw new Error(`verify equation "${eq}" is never defined for answer key "${p.answer}"`);
    }
  }
  return true;
}

const SAMPLE_POINTS = [0.53, -1.31, 2.17, -0.72, 1.46, 3.29, -2.58, 0.91];

/** Numeric derivative of node with respect to name at the scope. */
function derivativeAt(node: Node, name: string, scope: Record<string, number>): number {
  const h = 1e-5 * Math.max(1, Math.abs(scope[name]!));
  return (evaluate(node, { ...scope, [name]: scope[name]! + h }) - evaluate(node, { ...scope, [name]: scope[name]! - h })) / (2 * h);
}

/** Simpson's rule with 2000 strips; NaN when the integrand isn't finite somewhere. */
function integrate(node: Node, name: string, a: number, b: number, scope: Record<string, number>): number {
  const n = 2000;
  const h = (b - a) / n;
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const v = evaluate(node, { ...scope, [name]: a + i * h });
    if (!Number.isFinite(v)) return NaN;
    sum += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * v;
  }
  return (sum * h) / 3;
}

const close = (got: number, want: number, tol: number) => Math.abs(got - want) <= tol * Math.max(1, Math.abs(want));

/**
 * Derivative, integral and limit prompts, checked numerically. Returns null when the prompt isn't one of
 * these shapes, true when the key held up; throws when it's wrong.
 */
function verifyCalculus(p: Problem, raw: string[]): boolean | null {
  if ((p.form ?? "expr") !== "expr" || !p.answer || !raw.length) return null;
  const fail = (why: string) => {
    throw new Error(`answer key "${p.answer}" is wrong: ${why}`);
  };
  // "when x = 2" style bindings after the main expression.
  const given: Record<string, number> = {};
  for (const m of raw.slice(1)) {
    const mm = m.match(/^\s*([a-zA-Z])\s*=\s*([^=]+)$/);
    if (mm) {
      try {
        given[mm[1]!] = evaluate(parse(latexToText(mm[2]!)));
      } catch {
        /* not a plain number */
      }
    }
  }
  let answer: Node;
  try {
    answer = parse(p.answer);
  } catch {
    return null;
  }
  const scopes = (names: string[]) => SAMPLE_POINTS.map((s) => ({ ...Object.fromEntries(names.map((n, k) => [n, s + 0.41 * k])), ...given }));

  // Derivatives: "Differentiate $E$", "Find the derivative of $E$", "Find $f'(x)$ ... $f(x) = E$",
  // "Find $\frac{dy}{dx}$ ... $y = E$", "Find $\frac{\partial f}{\partial x}$ ... $f(x, y) = E$".
  let dExpr: string | null = null;
  let dVar: string | null = null;
  if (/^(Differentiate|Find the derivative of)\b/.test(p.prompt)) {
    dExpr = raw[0]!;
    dVar = p.prompt.match(/with respect to \$([a-z])\$/)?.[1] ?? null;
  } else {
    const prime = raw[0]!.match(/^\s*([a-zA-Z])'\(([a-z])\)\s*$/);
    const leibniz = raw[0]!.match(/^\s*\\frac\{(?:\\partial|d)\s*([a-zA-Z])\}\{(?:\\partial|d)\s*([a-z])\}\s*$/);
    const m = prime ?? leibniz;
    if (m && raw[1]) {
      const def = raw[1].match(new RegExp(`^\\s*${m[1]}(?:\\([a-z, ]*\\))?\\s*=\\s*([\\s\\S]+)$`));
      if (def) {
        dExpr = def[1]!;
        dVar = m[2]!;
      }
    }
  }
  if (dExpr !== null) {
    let node: Node;
    try {
      node = parse(latexToText(dExpr));
    } catch {
      return null;
    }
    const vars = [...variables(node)].filter((v) => v !== "e");
    const v = dVar ?? (vars.length === 1 ? vars[0]! : null);
    if (!v) return null;
    let checked = 0;
    for (const scope of scopes([...new Set([v, ...vars, ...variables(answer)])].filter((n) => n !== "e"))) {
      const want = derivativeAt(node, v, scope);
      const got = evaluate(answer, scope);
      if (!Number.isFinite(want) || !Number.isFinite(got)) continue;
      checked++;
      if (!close(got, want, 1e-4)) fail(`at ${v} = ${scope[v]} the derivative is ${want.toFixed(6)} but the key gives ${got.toFixed(6)}`);
    }
    return checked >= 3 ? true : null;
  }

  // Integrals: "$\int_{a}^{b} E \, dx$" (definite) or "$\int E \, dx$" (antiderivative).
  const integral = raw
    .map((r) => r.match(/\\int(?:_(?:\{([^{}]*)\}|(\S))\^(?:\{([^{}]*)\}|(\\?[a-zA-Z0-9]+|\S)))?\s*([\s\S]*?)\s*(?:\\[,;:!]\s*)*d([a-z])\s*$/))
    .find(Boolean);
  if (integral) {
    const [lo, hi, body, v] = [integral[1] ?? integral[2], integral[3] ?? integral[4], integral[5], integral[6]];
    let node: Node;
    try {
      node = parse(latexToText(body!));
    } catch {
      return null;
    }
    const others = [...new Set([...variables(node), ...variables(answer)])].filter((n) => n !== "e" && n !== v && !["C", "K", "c"].includes(n));
    if (lo !== undefined && hi !== undefined) {
      let a: number;
      let b: number;
      try {
        [a, b] = [evaluate(parse(latexToText(lo))), evaluate(parse(latexToText(hi)))];
      } catch {
        return null;
      }
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      let checked = 0;
      for (const scope of scopes(others)) {
        const want = integrate(node, v!, a, b, scope);
        const got = evaluate(answer, scope);
        if (!Number.isFinite(want) || !Number.isFinite(got)) continue;
        checked++;
        if (!close(got, want, 1e-5)) fail(`the integral is about ${want.toFixed(6)} but the key gives ${got.toFixed(6)}`);
        if (!others.length) break;
      }
      return checked > 0 ? true : null;
    }
    // Antiderivative: the key's derivative must be the integrand (any constant C is dropped).
    let F = answer;
    for (const c of ["C", "K", "c"]) F = substitute(F, c, { type: "num", value: 0, text: "0" });
    let checked = 0;
    for (const scope of scopes([v!, ...others])) {
      const want = evaluate(node, scope);
      const got = derivativeAt(F, v!, scope);
      if (!Number.isFinite(want) || !Number.isFinite(got)) continue;
      checked++;
      if (!close(got, want, 1e-4)) fail(`at ${v} = ${scope[v!]} the key's derivative is ${got.toFixed(6)} but the integrand is ${want.toFixed(6)}`);
    }
    return checked >= 3 ? true : null;
  }

  // Limits: "$\lim_{x \to a} E$", with a possibly \infty, -\infty, or a^+ / a^-.
  const limit = raw[0]!.match(/^\s*\\lim_\{?\s*([a-z])\s*\\to\s*(-?\\infty|[^{}^]+?)\s*(?:\^\{?([+-])\}?)?\s*\}?\s*([\s\S]+)$/);
  if (limit) {
    const [, v, target, side, body] = limit;
    let node: Node;
    let want: number;
    try {
      node = parse(latexToText(body!));
      want = evaluate(answer);
    } catch {
      return null;
    }
    if (!Number.isFinite(want) || variables(answer).size) return null;
    const infinite = /\\infty/.test(target!);
    let a = 0;
    if (!infinite) {
      try {
        a = evaluate(parse(latexToText(target!)));
      } catch {
        return null;
      }
      if (!Number.isFinite(a)) return null;
    }
    const sign = target!.startsWith("-") ? -1 : 1;
    const approaches = infinite ? [1e3, 1e5, 1e7].map((m) => [sign * m]) : [1e-3, 1e-5, 1e-7].map((h) => (side === "+" ? [a + h] : side === "-" ? [a - h] : [a - h, a + h]));
    const errs = approaches.map((xs) => Math.max(...xs.map((x) => Math.abs(evaluate(node, { [v!]: x }) - want))));
    if (errs.some((e) => !Number.isFinite(e))) return null;
    const last = errs[errs.length - 1]!;
    if (!(last <= 1e-3 * Math.max(1, Math.abs(want)) && last <= errs[0]! + 1e-9)) fail(`as ${v} approaches ${target}${side ?? ""} the expression nears ${(evaluate(node, { [v!]: approaches[2]![0]! })).toFixed(6)}, not ${want}`);
    return true;
  }
  return null;
}

// ── Static checks ───────────────────────────────────────────────────────────

/** Every $…$ / $$…$$ in lesson markup must render; returns error messages. */
export function markupErrors(text: string): string[] {
  const errors: string[] = [];
  if ((text.match(/\$/g) ?? []).length % 2) errors.push(`unbalanced $ in: ${text.slice(0, 80)}`);
  if (/\\u[0-9a-fA-F]{4}/.test(text)) errors.push(`literal unicode escape (String.raw instead of md?) in: ${text.slice(0, 80)}`);
  for (const m of text.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g)) errors.push(...texErrors(m[1] ?? m[2]!));
  return errors;
}

export function texErrors(tex: string): string[] {
  try {
    katex.renderToString(tex, { throwOnError: true, strict: "error" });
    return [];
  } catch (err) {
    return [`LaTeX error in "${tex}": ${(err as Error).message.split("\n")[0]}`];
  }
}

function choiceErrors(spec: AnswerSpec, where: string): string[] {
  if (!spec.choices) return [];
  const errs: string[] = [];
  const norm = (c: string) => c.trim().toLowerCase();
  if (spec.choices.length < 2) errs.push(`${where}: needs at least two choices`);
  if (new Set(spec.choices.map(norm)).size !== spec.choices.length) errs.push(`${where}: duplicate choices`);
  if (spec.answer !== undefined) errs.push(`${where}: choice questions put the right option in accept, not answer`);
  const right = spec.accept?.[0];
  if (!right || !spec.choices.some((c) => norm(c) === norm(right))) errs.push(`${where}: accept[0] "${right}" isn't one of the choices`);
  for (const c of spec.choices) errs.push(...markupErrors(c));
  return errs;
}

function diagramErrors(d: DiagramSpec): string[] {
  const errs: string[] = [];
  const scope = Object.fromEntries((d.params ?? []).map((p) => [p.name, p.value]));
  /** LaTeX check of a label after its {name} / {=expr} placeholders are filled in. */
  const labelTex = (tex: string) => {
    const filled = tex
      .replace(/\{=([^{}]+)\}/g, (_, e: string) => (num(e, "live label"), "1"))
      .replace(/\{(\w+)\}/g, (m, name: string) => (name in scope ? "1" : m));
    return texErrors(filled);
  };
  function num(v: number | string, what: string) {
    if (typeof v === "number") return;
    try {
      const node = parse(v);
      const unknown = [...variables(node)].filter((n) => !(n in scope) && n !== "e");
      if (unknown.length) errs.push(`diagram ${what} "${v}" uses ${unknown.join(", ")}, which isn't a slider`);
      else if (!Number.isFinite(evaluate(node, scope))) errs.push(`diagram ${what} "${v}" isn't a finite number`);
    } catch {
      errs.push(`diagram ${what} "${v}" doesn't parse`);
    }
  }
  const [x0, x1, y0, y1] = d.view;
  if (!(x0 < x1 && y0 < y1)) errs.push("diagram view must be [xmin, xmax, ymin, ymax]");
  const names = new Set<string>();
  for (const p of d.points ?? []) {
    if (names.has(p.name)) errs.push(`diagram point ${p.name} is defined twice`);
    names.add(p.name);
    num(p.x, `point ${p.name} x`);
    num(p.y, `point ${p.name} y`);
    errs.push(...labelTex(p.label ?? p.name));
  }
  const need = (n: string, what: string) => names.has(n) || errs.push(`diagram ${what} refers to unknown point "${n}"`);
  for (const s of d.segments ?? []) {
    need(s.from, "segment");
    need(s.to, "segment");
    if (s.label) errs.push(...labelTex(s.label));
  }
  for (const p of d.polygons ?? []) p.points.forEach((n) => need(n, "polygon"));
  for (const a of d.arcs ?? []) [a.center, a.from, a.to].forEach((n) => need(n, "arc"));
  for (const c of d.circles ?? []) {
    need(c.center, "circle");
    num(c.radius, "circle radius");
  }
  for (const a of d.angles ?? []) {
    [a.at, a.from, a.to].forEach((n) => need(n, "angle"));
    if (a.label) errs.push(...labelTex(a.label));
  }
  for (const l of d.labels ?? []) {
    num(l.x, "label x");
    num(l.y, "label y");
    errs.push(...labelTex(l.text));
  }
  for (const r of d.readouts ?? []) {
    num(r.value, "readout");
    errs.push(...texErrors(`${r.label} = 1${r.unit ?? ""}`));
  }
  for (const p of d.params ?? []) if (p.tex) errs.push(...texErrors(p.tex));
  return errs;
}

function plotErrors(block: PlotSpec): string[] {
  const errs: string[] = [];
  const scope = Object.fromEntries((block.params ?? []).map((p) => [p.name, p.value]));
  const label = (t: string) => t.replace(/\{=([^{}]+)\}/g, "1").replace(/\{(\w+)\}/g, "1");
  for (const c of block.curves ?? []) {
    try {
      const node = parse(c.expr);
      const xs = Array.from({ length: 41 }, (_, i) => block.x[0] + ((block.x[1] - block.x[0]) * i) / 40);
      if (!xs.some((x) => Number.isFinite(evaluate(node, { ...scope, x })))) errs.push(`plot curve "${c.expr}" is never finite on the x-range`);
      const unknown = [...variables(node)].filter((v) => v !== "x" && v !== "e" && !(v in scope));
      if (unknown.length) errs.push(`plot curve "${c.expr}" uses ${unknown.join(", ")}, which isn't x or a slider`);
    } catch (err) {
      errs.push(`plot curve "${c.expr}" doesn't parse: ${(err as Error).message}`);
    }
    if (c.label) errs.push(...texErrors(label(c.label)));
  }
  for (const p of block.points ?? []) {
    for (const v of [p.x, p.y]) {
      if (typeof v === "string") {
        try {
          if (!Number.isFinite(evaluate(parse(v), scope))) errs.push(`plot point coordinate "${v}" isn't a number`);
        } catch {
          errs.push(`plot point coordinate "${v}" doesn't parse`);
        }
      }
    }
    if (p.label) errs.push(...texErrors(label(p.label)));
  }
  for (const p of block.params ?? []) if (p.tex) errs.push(...texErrors(p.tex));
  if (block.x[0] >= block.x[1] || block.y[0] >= block.y[1]) errs.push("plot ranges must be [low, high]");
  const expr = (what: string, e: string, allowed: string[]) => {
    try {
      const unknown = [...variables(parse(e))].filter((v) => v !== "e" && !allowed.includes(v) && !(v in scope));
      if (unknown.length) errs.push(`${what} "${e}" uses ${unknown.join(", ")}, which isn't ${allowed.join("/")} or a slider`);
    } catch (err) {
      errs.push(`${what} "${e}" doesn't parse: ${(err as Error).message}`);
    }
  };
  const num = (what: string, v: number | string) => typeof v === "string" && expr(what, v, []);
  for (const s of block.shade ?? []) {
    expr("shade", s.expr, ["x"]);
    if (s.under) expr("shade under", s.under, ["x"]);
    num("shade bound", s.from);
    num("shade bound", s.to);
  }
  if (block.riemann) {
    expr("riemann", block.riemann.expr, ["x"]);
    num("riemann bound", block.riemann.from);
    num("riemann bound", block.riemann.to);
    num("riemann n", block.riemann.n);
  }
  if (block.field) {
    expr("field dx", block.field.dx, ["x", "y"]);
    expr("field dy", block.field.dy, ["x", "y"]);
  }
  for (const c of block.parametric ?? []) {
    expr("parametric x", c.x, ["t"]);
    expr("parametric y", c.y, ["t"]);
    if (c.t[0] >= c.t[1]) errs.push(`parametric t range must be [low, high]`);
    if (c.label) errs.push(...texErrors(label(c.label)));
  }
  for (const v of block.vlines ?? []) num("vline", v.x);
  for (const h of block.hlines ?? []) num("hline", h.y);
  return errs;
}

function surfaceErrors(block: ContourSpec | SurfaceSpec): string[] {
  const errs: string[] = [];
  const scope = Object.fromEntries((block.params ?? []).map((p) => [p.name, p.value]));
  const label = (t: string) => t.replace(/\{=([^{}]+)\}/g, "1").replace(/\{(\w+)\}/g, "1");
  try {
    const node = parse(block.expr);
    const unknown = [...variables(node)].filter((v) => !["x", "y", "e"].includes(v) && !(v in scope));
    if (unknown.length) errs.push(`surface "${block.expr}" uses ${unknown.join(", ")}, which isn't x, y or a slider`);
    let finite = 0;
    for (let i = 0; i <= 10; i++) {
      for (let j = 0; j <= 10; j++) {
        const x = block.x[0] + ((block.x[1] - block.x[0]) * i) / 10;
        const y = block.y[0] + ((block.y[1] - block.y[0]) * j) / 10;
        if (Number.isFinite(evaluate(node, { ...scope, x, y }))) finite++;
      }
    }
    if (!finite) errs.push(`surface "${block.expr}" is never finite on its ranges`);
  } catch (err) {
    errs.push(`surface "${block.expr}" doesn't parse: ${(err as Error).message}`);
  }
  if (block.x[0] >= block.x[1] || block.y[0] >= block.y[1]) errs.push("surface ranges must be [low, high]");
  for (const p of block.params ?? []) if (p.tex) errs.push(...texErrors(p.tex));
  if ("points" in block || "arrows" in block) {
    for (const p of [...(block.points ?? []), ...(block.arrows ?? [])]) {
      for (const v of Object.values(p)) {
        if (typeof v !== "string" || v === p.label) continue;
        try {
          if (!Number.isFinite(evaluate(parse(v), scope))) errs.push(`contour coordinate "${v}" isn't a number`);
        } catch {
          errs.push(`contour coordinate "${v}" doesn't parse`);
        }
      }
      if (p.label) errs.push(...texErrors(label(p.label)));
    }
  }
  return errs;
}

export function figureErrors(f: Figure): string[] {
  return f.kind === "diagram" ? diagramErrors(f) : f.kind === "contour" ? surfaceErrors(f) : plotErrors(f);
}

function blockErrors(block: Block): string[] {
  const errs: string[] = [];
  const text = (s: string | undefined) => s && errs.push(...markupErrors(s));
  switch (block.kind) {
    case "text":
      text(block.body);
      break;
    case "key":
    case "why":
      text(block.title);
      text(block.body);
      break;
    case "example":
      text(block.title);
      text(block.problem);
      if (block.steps.length === 0) errs.push(`example "${block.title}" has no steps`);
      for (const s of block.steps) {
        errs.push(...texErrors(s.math));
        text(s.note);
      }
      break;
    case "check": {
      text(block.prompt);
      text(block.explain);
      const typed = block.answer ?? block.accept?.[0];
      if (!typed) errs.push(`check "${block.prompt}" has no answer`);
      else {
        errs.push(...choiceErrors(block, `check "${block.prompt}"`));
        const v = checkAnswer(typed, block);
        if (v.status !== "correct") errs.push(`check "${block.prompt}": its own answer "${typed}" is judged ${v.status}`);
      }
      break;
    }
    case "plot":
      text(block.caption);
      errs.push(...plotErrors(block));
      break;
    case "diagram":
      text(block.caption);
      errs.push(...diagramErrors(block));
      break;
    case "contour":
    case "surface":
      text(block.caption);
      errs.push(...surfaceErrors(block));
      break;
    case "proof":
      text(block.title);
      text(block.given);
      text(block.prove);
      if (block.steps.length === 0) errs.push(`proof "${block.title}" has no steps`);
      for (const st of block.steps) {
        text(st.statement);
        text(st.reason);
      }
      break;
    case "numberline":
      text(block.caption);
      if (block.range[0] >= block.range[1]) errs.push("numberline range must be [low, high]");
      for (const p of block.points ?? []) if (p.label) errs.push(...texErrors(p.label));
      break;
    case "widget":
      break;
  }
  return errs;
}

export interface UnitReport {
  errors: string[];
  /** Generated problems whose answer key was independently re-derived. */
  verified: number;
  total: number;
  /** A few generated problems per generator, for reading. */
  samples: string[];
}

export function validateUnit(unit: Unit, { seeds = 300, samplesPer = 3 } = {}): UnitReport {
  const report: UnitReport = { errors: [], verified: 0, total: 0, samples: [] };
  const err = (where: string, msg: string) => report.errors.length < 200 && report.errors.push(`${where}: ${msg}`);
  const ids = new Set<string>();

  for (const lesson of unit.lessons) {
    if (ids.has(lesson.id)) err(lesson.id, "duplicate lesson id");
    ids.add(lesson.id);
    if (!isWritten(lesson)) continue;
    if (!lesson.summary) err(lesson.id, "missing summary");
    if (!lesson.practice?.length) err(lesson.id, "no practice generators");
    for (const block of lesson.blocks!) for (const e of blockErrors(block)) err(lesson.id, e);

    for (const [g, gen] of (lesson.practice ?? []).entries()) {
      for (let seed = 1; seed <= seeds; seed++) {
        const where = `${lesson.id} generator #${g} seed ${seed}`;
        let p: Problem;
        try {
          p = gen(rng(seed));
        } catch (e) {
          err(where, `generator threw: ${(e as Error).message}`);
          break;
        }
        report.total++;
        if (seed <= samplesPer) report.samples.push(`[${lesson.id} #${g}] ${p.prompt}  =>  ${p.answer ?? p.accept?.join(" | ")}`);
        const typed = p.answer ?? p.accept?.[0];
        if (!typed) {
          err(where, "problem has neither answer nor accept");
          continue;
        }
        const v = checkAnswer(typed, p);
        if (v.status !== "correct") err(where, `own answer "${typed}" judged ${v.status}${"message" in v && v.message ? ` (${v.message})` : ""} for: ${p.prompt}`);
        if (!p.solution.length) err(where, "empty solution");
        for (const e of choiceErrors(p, "choices")) err(where, e);
        if (p.figure) for (const e of figureErrors(p.figure)) err(where, `figure: ${e}`);
        for (const e of [...markupErrors(p.prompt), ...markupErrors(p.hint), ...p.solution.flatMap((s) => [...texErrors(s.math), ...(s.note ? markupErrors(s.note) : [])])]) {
          err(where, e);
        }
        try {
          if (verifyProblem(p)) report.verified++;
        } catch (e) {
          err(where, `${(e as Error).message} -- prompt: ${p.prompt}`);
        }
      }
    }
  }
  return report;
}
