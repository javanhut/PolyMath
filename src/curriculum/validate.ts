// Checks a unit of lesson content: every piece of LaTeX renders, every
// "Try it" check accepts its own answer, every graph expression parses, and
// every practice generator produces answer keys that are actually right.
// Used by the test suite and by scripts/check-unit.ts while writing a unit.

import katex from "katex";
import { checkAnswer, parseInequality, splitTopLevel } from "../math/check";
import { evaluate, evaluateComplex, parse, parseEquation, variables, type Node } from "../math/expr";
import { rng } from "../math/random";
import { isWritten, type Block, type DiagramSpec, type Figure, type PlotSpec, type Problem, type Unit } from "./types";
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
    // No \b: "_" is a word character, so \log_{2} must still match.
    .replace(/\\(ln|log|sin|cos|tan|exp)(?![a-zA-Z])/g, " $1")
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
  const math = [...p.prompt.matchAll(/\$([^$]+)\$/g)].map((m) => latexToText(m[1]!));
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
    const names = [...new Set([...variables(l), ...variables(r)])].filter((n) => !(p.complex && n === "i") && n !== "e").sort();
    for (const vals of values) {
      if (names.length !== vals.length) throw new Error(`verify equation "${eq}" has unknowns ${names.join(", ") || "(none)"} but the answer has ${vals.length} value(s)`);
      let [a, b] = [l, r];
      names.forEach((n, i) => {
        a = substitute(a, n, vals[i]!);
        b = substitute(b, n, vals[i]!);
      });
      const [x, y] = [evaluateComplex(a), evaluateComplex(b)];
      if (!(Math.hypot(x[0] - y[0], x[1] - y[1]) <= 1e-7 * Math.max(1, Math.hypot(x[0], x[1])))) {
        throw new Error(`answer key "${p.answer}" fails verify equation "${eq}"`);
      }
    }
  }
  return true;
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
  return errs;
}

export function figureErrors(f: Figure): string[] {
  return f.kind === "diagram" ? diagramErrors(f) : plotErrors(f);
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
