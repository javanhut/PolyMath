import { frac, fracTex, paren, poly, type Rng } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Shared wording and helpers ──────────────────────────────────────────────

const S_FORMAT = md`Give $F(s)$ as an expression in $s$, like 2/(s - 1) + 3/(s^2 + 4). Any equal form is accepted.`;
const T_FORMAT = md`Give $f(t)$ as an expression in $t$, like (3/4) sin(4t) + 2e^(2t). Any equal form is accepted.`;

/** "s - a" in LaTeX and in typed text: lin(3) = "s - 3", lin(-2) = "s + 2", lin(0) = "s". */
const lin = (a: number) => (a === 0 ? "s" : a > 0 ? `s - ${a}` : `s + ${-a}`);
/** The same as a factor: par(0) = "s", par(2) = "(s - 2)". */
const par = (a: number) => (a === 0 ? "s" : `(${lin(a)})`);
/** A polynomial identity in s checked at a few fixed values of s (the validator binds only the answer's letters). */
const atPoints = (eq: (s: string) => string, n: number) => [1, 2, 3, -2].slice(0, n).map((v) => eq(`(${v})`));

/** A coefficient in front of a body: coef(1, "t") = "t", coef(-1, "t") = "-t", coef(3, "") = "3". */
function coef(k: number, body: string): string {
  if (!body) return String(k);
  if (k === 1) return body;
  if (k === -1) return `-${body}`;
  return `${k}${body}`;
}

/** Join signed terms the way a person writes them: ["3t", "-2e^{t}"] -> "3t - 2e^{t}". */
function join(terms: string[]): string {
  let out = "";
  for (const t of terms) {
    if (!t || t === "0") continue;
    if (!out) out = t;
    else out += t.startsWith("-") ? ` - ${t.slice(1)}` : ` + ${t}`;
  }
  return out || "0";
}

/** A fraction coefficient as typed text in front of a body: fc("5/6", "t^3") = "(5/6) t^3". */
function fc(f: string, body: string): string {
  if (f.startsWith("-")) return `-${fc(f.slice(1), body)}`;
  if (!body) return f;
  if (f === "1") return body;
  return f.includes("/") ? `(${f}) ${body}` : `${f} ${body}`;
}

/** The same coefficient in LaTeX. */
function fcTex(n: number, d: number, body: string): string {
  const f = fracTex(n, d);
  if (!body) return f;
  if (f === "1") return body;
  if (f === "-1") return `-${body}`;
  return `${f}${body}`;
}

const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));

/** e^{at} in LaTeX, with the 1 hidden. */
const eTex = (a: number) => `e^{${a === 1 ? "" : a === -1 ? "-" : a}t}`;
/** e^(at) as typed text. */
const eText = (a: number) => `e^(${a === 1 ? "" : a === -1 ? "-" : a}t)`;

// ── Lesson 1: The Laplace transform ─────────────────────────────────────────

interface TableTerm {
  /** k times the function, in LaTeX. */
  ftex: string;
  /** Its transform in LaTeX and as typed text. */
  Ftex: string;
  Ftext: string;
  /** The table line used, for the solution. */
  rule: string;
  /** A relation F must satisfy, from the derivative rule: independent of the table. */
  verify: string;
}

/** One table entry times a coefficient k. kind: 0 constant, 1 power, 2 exponential, 3 sine, 4 cosine. */
function tableTerm(r: Rng, k: number, kind: number): TableTerm {
  if (kind === 0) {
    return { ftex: String(k), Ftex: `\\frac{${k}}{s}`, Ftext: `${k}/s`, rule: md`$\mathcal{L}\{1\} = \frac{1}{s}$`, verify: `s F = ${k}` };
  }
  if (kind === 1) {
    const n = r.int(1, 3);
    const c = k * fact(n);
    return {
      ftex: coef(k, `t${n === 1 ? "" : `^{${n}}`}`),
      Ftex: `\\frac{${c}}{s^{${n + 1}}}`,
      Ftext: `${c}/s^${n + 1}`,
      rule: md`$\mathcal{L}\{t^{${n}}\} = \frac{${n}!}{s^{${n + 1}}} = \frac{${fact(n)}}{s^{${n + 1}}}$`,
      verify: `s^${n + 1} F = ${c}`,
    };
  }
  if (kind === 2) {
    const a = r.nonzero(-4, 4);
    return {
      ftex: coef(k, eTex(a)),
      Ftex: `\\frac{${k}}{${lin(a)}}`,
      Ftext: `${k}/(${lin(a)})`,
      rule: md`$\mathcal{L}\{e^{at}\} = \frac{1}{s - a}$ with $a = ${a}$`,
      verify: `s F - ${k} = ${a} F`,
    };
  }
  const b = r.int(1, 5);
  if (kind === 3) {
    return {
      ftex: coef(k, `\\sin(${b === 1 ? "" : b}t)`),
      Ftex: `\\frac{${k * b}}{s^2 + ${b * b}}`,
      Ftext: `${k * b}/(s^2 + ${b * b})`,
      rule: md`$\mathcal{L}\{\sin(bt)\} = \frac{b}{s^2 + b^2}$ with $b = ${b}$`,
      verify: `s^2 F - ${k * b} = -${b * b} F`,
    };
  }
  return {
    ftex: coef(k, `\\cos(${b === 1 ? "" : b}t)`),
    Ftex: `\\frac{${k === 1 ? "" : k === -1 ? "-" : k}s}{s^2 + ${b * b}}`,
    Ftext: `${k}s/(s^2 + ${b * b})`,
    rule: md`$\mathcal{L}\{\cos(bt)\} = \frac{s}{s^2 + b^2}$ with $b = ${b}$`,
    verify: `s^2 F - ${k} s = -${b * b} F`,
  };
}

const transformSingle: Generator = (r) => {
  const kind = r.int(0, 4);
  const k = kind === 0 ? r.coef(-9, 9) : r.nonzero(-6, 6);
  const term = tableTerm(r, k, kind);
  const steps: Step[] = [{ math: md`\mathcal{L}\{${term.ftex}\} = ${k === 1 ? "" : `${k} \\cdot `}\mathcal{L}\{${kind === 0 ? "1" : term.ftex.replace(/^-?\d*/, "").replace(/^-/, "")}\}`, note: "Linearity: a constant factor comes out of the integral." }];
  steps.push({ math: md`F(s) = ${term.Ftex}`, note: md`Table line ${term.rule}.` });
  return {
    prompt: md`Find the Laplace transform of $f(t) = ${term.ftex}$. ${S_FORMAT}`,
    answer: term.Ftext,
    positive: true,
    verify: [term.verify],
    hint: md`Pull the constant out by linearity, then read the table: $\mathcal{L}\{1\} = \frac1s$, $\mathcal{L}\{t^n\} = \frac{n!}{s^{n+1}}$, $\mathcal{L}\{e^{at}\} = \frac{1}{s - a}$, $\mathcal{L}\{\sin bt\} = \frac{b}{s^2 + b^2}$, $\mathcal{L}\{\cos bt\} = \frac{s}{s^2 + b^2}$.`,
    solution: steps,
  };
};

const transformSum: Generator = (r) => {
  const kind = r.int(0, 6);
  let ftex: string;
  let parts: string[];
  let Ftexts: string[];
  let verify: string;
  let notes: string[];
  if (kind === 0) {
    const [a, b] = [r.nonzero(-7, 7), r.nonzero(-6, 6)];
    ftex = join([String(a), coef(b, "t")]);
    parts = [`\\frac{${a}}{s}`, `\\frac{${b}}{s^2}`];
    Ftexts = [`${a}/s`, `${b}/s^2`];
    verify = `s^2 F - ${paren(a)} s - ${paren(b)} = 0`;
    notes = [md`$\mathcal{L}\{1\} = \frac1s$`, md`$\mathcal{L}\{t\} = \frac{1!}{s^2} = \frac{1}{s^2}$`];
  } else if (kind === 1) {
    const [a, b] = [r.nonzero(-6, 6), r.nonzero(-4, 4)];
    ftex = join([coef(a, "t"), coef(b, "t^2")]);
    parts = [`\\frac{${a}}{s^2}`, `\\frac{${2 * b}}{s^3}`];
    Ftexts = [`${a}/s^2`, `${2 * b}/s^3`];
    verify = `s^3 F - ${paren(a)} s - ${paren(2 * b)} = 0`;
    notes = [md`$\mathcal{L}\{t\} = \frac{1}{s^2}$`, md`$\mathcal{L}\{t^2\} = \frac{2!}{s^3} = \frac{2}{s^3}$`];
  } else if (kind === 2) {
    const [a, b, k] = [r.nonzero(-7, 7), r.nonzero(-5, 5), r.nonzero(-4, 4)];
    ftex = join([String(a), coef(b, eTex(k))]);
    parts = [`\\frac{${a}}{s}`, `\\frac{${b}}{${lin(k)}}`];
    Ftexts = [`${a}/s`, `${b}/(${lin(k)})`];
    verify = `s F - ${paren(a + b)} = ${k} (F - ${paren(a)}/s)`;
    notes = [md`$\mathcal{L}\{1\} = \frac1s$`, md`$\mathcal{L}\{e^{at}\} = \frac{1}{s - a}$ with $a = ${k}$`];
  } else if (kind === 3) {
    const k = r.nonzero(-4, 4);
    let m = r.nonzero(-4, 4);
    while (m === k) m = r.nonzero(-4, 4);
    const [a, b] = [r.nonzero(-5, 5), r.nonzero(-5, 5)];
    ftex = join([coef(a, eTex(k)), coef(b, eTex(m))]);
    parts = [`\\frac{${a}}{${lin(k)}}`, `\\frac{${b}}{${lin(m)}}`];
    Ftexts = [`${a}/(${lin(k)})`, `${b}/(${lin(m)})`];
    // f'' - (k + m) f' + k m f = 0 with f(0) = a + b, f'(0) = ak + bm.
    verify = `(s^2 F - ${paren(a + b)} s - ${paren(a * k + b * m)}) - ${paren(k + m)} (s F - ${paren(a + b)}) + ${paren(k * m)} F = 0`;
    notes = [md`$\mathcal{L}\{e^{at}\} = \frac{1}{s - a}$ with $a = ${k}$`, md`the same line with $a = ${m}$`];
  } else if (kind === 4) {
    const b = r.int(1, 5);
    const [a, c] = [r.nonzero(-5, 5), r.nonzero(-5, 5)];
    const bt = `${b === 1 ? "" : b}t`;
    ftex = join([coef(a, `\\sin(${bt})`), coef(c, `\\cos(${bt})`)]);
    parts = [`\\frac{${a * b}}{s^2 + ${b * b}}`, `\\frac{${c === 1 ? "" : c === -1 ? "-" : c}s}{s^2 + ${b * b}}`];
    Ftexts = [`${a * b}/(s^2 + ${b * b})`, `${c}s/(s^2 + ${b * b})`];
    verify = `s^2 F - ${paren(c)} s - ${paren(a * b)} = -${b * b} F`;
    notes = [md`$\mathcal{L}\{\sin bt\} = \frac{b}{s^2 + b^2}$ with $b = ${b}$`, md`$\mathcal{L}\{\cos bt\} = \frac{s}{s^2 + b^2}$`];
  } else if (kind === 5) {
    const k = r.int(1, 4);
    const [a, b] = [r.nonzero(-7, 7), r.nonzero(-5, 5)];
    const trig = r.next() < 0.5;
    const kt = `${k === 1 ? "" : k}t`;
    ftex = join([String(a), coef(b, trig ? `\\sin(${kt})` : `\\cos(${kt})`)]);
    parts = [`\\frac{${a}}{s}`, trig ? `\\frac{${b * k}}{s^2 + ${k * k}}` : `\\frac{${b === 1 ? "" : b === -1 ? "-" : b}s}{s^2 + ${k * k}}`];
    Ftexts = [`${a}/s`, trig ? `${b * k}/(s^2 + ${k * k})` : `${b}s/(s^2 + ${k * k})`];
    // f'' = -k^2 (f - a); f(0) = a (+ b for cosine), f'(0) = bk (0 for cosine).
    verify = trig ? `s^2 F - ${paren(a)} s - ${paren(b * k)} = -${k * k} (F - ${paren(a)}/s)` : `s^2 F - ${paren(a + b)} s = -${k * k} (F - ${paren(a)}/s)`;
    notes = [md`$\mathcal{L}\{1\} = \frac1s$`, trig ? md`$\mathcal{L}\{\sin bt\} = \frac{b}{s^2 + b^2}$ with $b = ${k}$` : md`$\mathcal{L}\{\cos bt\} = \frac{s}{s^2 + b^2}$ with $b = ${k}$`];
  } else {
    const [a, b, k] = [r.nonzero(-6, 6), r.nonzero(-5, 5), r.nonzero(-4, 4)];
    ftex = join([coef(a, "t"), coef(b, eTex(k))]);
    parts = [`\\frac{${a}}{s^2}`, `\\frac{${b}}{${lin(k)}}`];
    Ftexts = [`${a}/s^2`, `${b}/(${lin(k)})`];
    // f' = a + k b e^{kt} = a + k (f - a t); f(0) = b.
    verify = `s F - ${paren(b)} = ${paren(a)}/s + ${k} (F - ${paren(a)}/s^2)`;
    notes = [md`$\mathcal{L}\{t\} = \frac{1}{s^2}$`, md`$\mathcal{L}\{e^{at}\} = \frac{1}{s - a}$ with $a = ${k}$`];
  }
  return {
    prompt: md`Find the Laplace transform of $f(t) = ${ftex}$. ${S_FORMAT}`,
    answer: join(Ftexts),
    positive: true,
    verify: [verify],
    hint: "The transform of a sum is the sum of the transforms, and constants come out in front. Look up each piece in the table.",
    solution: [
      { math: md`F(s) = ${parts[0]} + ${parts[1]!.startsWith("\\frac{-") ? `\\left(${parts[1]}\\right)` : parts[1]}`, note: md`Linearity splits the sum. First term: ${notes[0]}. Second term: ${notes[1]}.` },
      { math: md`F(s) = ${join(parts.map((p) => p.replace(/^\\frac\{-(.*)\}\{(.*)\}$/, "-\\frac{$1}{$2}")))}`, note: "Tidy the signs. Both terms need the same restriction on s, so the transform exists for s past the largest growth rate." },
    ],
  };
};

const inverseBasic: Generator = (r) => {
  type Piece = { Ftex: string; ftex: string; ftext: string; note: string };
  const piece = (kind: number): Piece => {
    if (kind === 0) {
      const c = r.nonzero(-9, 9);
      return { Ftex: `\\frac{${c}}{s}`, ftex: String(c), ftext: String(c), note: md`$\frac{${c}}{s} = ${c} \cdot \frac1s$, and $\frac1s$ is the transform of 1.` };
    }
    if (kind === 1) {
      const n = r.int(2, 3);
      const c = r.pick([1, 2, 3, 4, 5, 6, 8, 10, 12].filter((v) => v !== fact(n)));
      const body = `t^${n}`;
      return {
        Ftex: `\\frac{${c}}{s^{${n + 1}}}`,
        ftex: fcTex(c, fact(n), `t^{${n}}`),
        ftext: fc(frac(c, fact(n)), body),
        note: md`$\frac{1}{s^{${n + 1}}}$ needs a ${fact(n)} on top to be $\mathcal{L}\{t^${n}\} = \frac{${n}!}{s^{${n + 1}}}$, so write $\frac{${c}}{s^{${n + 1}}} = \frac{${c}}{${fact(n)}} \cdot \frac{${fact(n)}}{s^{${n + 1}}}$.`,
      };
    }
    if (kind === 2) {
      const a = r.nonzero(-5, 5);
      const c = r.nonzero(-6, 6);
      return { Ftex: `\\frac{${c}}{${lin(a)}}`, ftex: coef(c, eTex(a)), ftext: coef(c, eText(a)), note: md`$\frac{1}{s - a}$ is the transform of $e^{at}$; here $a = ${a}$.` };
    }
    const b = r.int(2, 5);
    if (kind === 3) {
      const c = r.pick([1, 2, 3, 4, 5, 6, 8, 10].filter((v) => v !== b));
      return {
        Ftex: `\\frac{${c}}{s^2 + ${b * b}}`,
        ftex: fcTex(c, b, `\\sin(${b}t)`),
        ftext: fc(frac(c, b), `sin(${b}t)`),
        note: md`$s^2 + ${b * b}$ means $b = ${b}$. The sine line needs $${b}$ on top: $\frac{${c}}{s^2 + ${b * b}} = \frac{${c}}{${b}} \cdot \frac{${b}}{s^2 + ${b * b}}$.`,
      };
    }
    const c = r.nonzero(-6, 6);
    return {
      Ftex: `\\frac{${c === 1 ? "" : c === -1 ? "-" : c}s}{s^2 + ${b * b}}`,
      ftex: coef(c, `\\cos(${b}t)`),
      ftext: coef(c, `cos(${b}t)`),
      note: md`An $s$ on top over $s^2 + ${b * b}$ is the cosine line with $b = ${b}$.`,
    };
  };
  const single = r.next() < 0.35;
  const k1 = r.int(1, 4);
  const p1 = piece(single ? k1 : r.int(0, 4));
  if (single) {
    return {
      prompt: md`Find the inverse Laplace transform of $F(s) = ${p1.Ftex}$. ${T_FORMAT}`,
      answer: p1.ftext,
      hint: "Match the shape of the denominator to a table line, then fix the constant on top.",
      solution: [{ math: md`f(t) = ${p1.ftex}`, note: p1.note }],
    };
  }
  let k2 = r.int(0, 4);
  while (k2 === (single ? k1 : -1) || (p1.Ftex.includes("s^2 +") && k2 >= 3)) k2 = r.int(0, 4);
  const p2 = piece(k2);
  const negFrac = (tex: string) => tex.replace(/^\\frac\{-(.*)\}\{(.*)\}$/, "-\\frac{$1}{$2}");
  const Ftex = join([negFrac(p1.Ftex), negFrac(p2.Ftex)]);
  return {
    prompt: md`Find the inverse Laplace transform of $F(s) = ${Ftex}$. ${T_FORMAT}`,
    answer: join([p1.ftext, p2.ftext]),
    hint: "Invert term by term (linearity works backwards too). Match each denominator to a table line, then adjust the constant on top.",
    solution: [
      { math: md`\mathcal{L}^{-1}\left\{${negFrac(p1.Ftex)}\right\} = ${p1.ftex}`, note: p1.note },
      { math: md`\mathcal{L}^{-1}\left\{${negFrac(p2.Ftex)}\right\} = ${p2.ftex}`, note: p2.note },
      { math: md`f(t) = ${join([p1.ftex, p2.ftex])}`, note: "Add the pieces: the inverse transform is linear because the transform is." },
    ],
  };
};

// ── Lesson 2: Solving initial value problems ────────────────────────────────

const partialFractions: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const p = r.int(-4, 4);
    let q = r.int(-4, 4);
    while (q === p) q = r.int(-4, 4);
    const [A, B] = [r.nonzero(-5, 5), r.nonzero(-5, 5)];
    // (cs + d) = A (s - q) + B (s - p)
    const c = A + B;
    const d = -(A * q + B * p);
    const numTex = poly([[c, "s"], [d, ""]]);
    const den = `${par(p)}${par(q)}`;
    return {
      prompt: md`Write $F(s) = \frac{${numTex}}{${den}}$ as $\frac{A}{${lin(p)}} + \frac{B}{${lin(q)}}$. Give $(A, B)$, like (2, -1).`,
      answer: `(${A}, ${B})`,
      form: "tuple",
      verify: atPoints((v) => `A (${v} - ${paren(q)}) + B (${v} - ${paren(p)}) = ${c} ${v} + ${paren(d)}`, 2),
      hint: md`Multiply both sides by $${den}$ to clear the fractions, then substitute $s = ${p}$ (which kills the $B$ term) and $s = ${q}$ (which kills the $A$ term).`,
      solution: [
        { math: md`${numTex} = A(${lin(q)}) + B(${lin(p)})`, note: md`Multiply through by $${den}$. This must hold for every $s$.` },
        { math: md`s = ${p}: \quad ${c * p + d} = A \cdot ${paren(p - q)} \;\Rightarrow\; A = ${A}`, note: md`At $s = ${p}$ the factor $${lin(p)}$ is 0, so the $B$ term vanishes.` },
        { math: md`s = ${q}: \quad ${c * q + d} = B \cdot ${paren(q - p)} \;\Rightarrow\; B = ${B}`, note: md`At $s = ${q}$ the $A$ term vanishes instead.` },
        { math: md`F(s) = \frac{${A}}{${lin(p)}} ${B < 0 ? "-" : "+"} \frac{${Math.abs(B)}}{${lin(q)}}`, note: md`So $(A, B) = (${A}, ${B})$. Check by adding the fractions back together.` },
      ],
    };
  }
  if (kind === 1) {
    const p = r.int(-3, 3);
    const [A, B] = [r.nonzero(-4, 4), r.nonzero(-5, 5)];
    // (cs + d) = A (s - p) + B
    const c = A;
    const d = B - A * p;
    const numTex = poly([[c, "s"], [d, ""]]);
    const den = `${par(p)}^2`;
    return {
      prompt: md`Write $F(s) = \frac{${numTex}}{${den}}$ as $\frac{A}{${lin(p)}} + \frac{B}{${den}}$. Give $(A, B)$, like (2, -1).`,
      answer: `(${A}, ${B})`,
      form: "tuple",
      verify: atPoints((v) => `A (${v} - ${paren(p)}) + B = ${c} ${v} + ${paren(d)}`, 2),
      hint: md`Multiply through by $${den}$. Substituting $s = ${p}$ gives $B$ at once; comparing the $s$ terms gives $A$.`,
      solution: [
        { math: md`${numTex} = A(${lin(p)}) + B`, note: md`Multiply through by $${den}$. A repeated factor gets one term for each power.` },
        { math: md`s = ${p}: \quad ${c * p + d} = B`, note: md`At $s = ${p}$ the $A$ term vanishes.` },
        { math: md`A = ${A}`, note: md`The coefficient of $s$ on the left is $${c}$; on the right it is $A$.` },
        { math: md`F(s) = \frac{${A}}{${lin(p)}} ${B < 0 ? "-" : "+"} \frac{${Math.abs(B)}}{${den}}`, note: md`So $(A, B) = (${A}, ${B})$.` },
      ],
    };
  }
  const p = r.int(-3, 3);
  const k = r.int(1, 3);
  const [A, B, C] = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-4, 4)];
  // N(s) = A (s^2 + k^2) + (Bs + C)(s - p)
  const c2 = A + B;
  const c1 = C - B * p;
  const c0 = A * k * k - C * p;
  const numTex = poly([[c2, "s^2"], [c1, "s"], [c0, ""]]);
  const quad = `s^2 + ${k * k}`;
  const den = `${par(p)}(${quad})`;
  return {
    prompt: md`Write $F(s) = \frac{${numTex}}{${den}}$ as $\frac{A}{${lin(p)}} + \frac{Bs + C}{${quad}}$. Give $(A, B, C)$, like (2, -1, 3).`,
    answer: `(${A}, ${B}, ${C})`,
    form: "tuple",
    verify: atPoints((v) => `A (${v}^2 + ${k * k}) + (B ${v} + C)(${v} - ${paren(p)}) = ${c2} ${v}^2 + ${paren(c1)} ${v} + ${paren(c0)}`, 3),
    hint: md`Clear the fractions. Substitute $s = ${p}$ to get $A$. Then compare the $s^2$ coefficients to get $B$, and the $s$ coefficients to get $C$.`,
    solution: [
      { math: md`${numTex} = A(${quad}) + (Bs + C)(${lin(p)})`, note: md`Multiply through by $${den}$. An irreducible quadratic factor gets a linear numerator $Bs + C$.` },
      { math: md`s = ${p}: \quad ${c2 * p * p + c1 * p + c0} = A \cdot ${p * p + k * k} \;\Rightarrow\; A = ${A}`, note: md`At $s = ${p}$ the second term vanishes.` },
      { math: md`s^2: \quad ${c2} = A + B \;\Rightarrow\; B = ${B}`, note: md`Expanding the right side, the $s^2$ terms are $As^2 + Bs^2$.` },
      { math: md`s^1: \quad ${c1} = C - ${paren(p)}B \;\Rightarrow\; C = ${C}`, note: md`The $s$ terms on the right are $Cs - pBs$ with $p = ${p}$.` },
      { math: md`(A, B, C) = (${A}, ${B}, ${C})`, note: "Check by expanding the right side with these values." },
    ],
  };
};

/** A forcing term from the table, with its transform. kind 0: none. */
function forcing(r: Rng, kind: number): { gtex: string; Gtex: string; Gtext: string; rule: string } {
  const k = r.int(1, 6);
  if (kind === 1) {
    const a = r.nonzero(-3, 3);
    return { gtex: coef(k, eTex(a)), Gtex: `\\frac{${k}}{${lin(a)}}`, Gtext: `${k}/(${lin(a)})`, rule: md`$\mathcal{L}\{e^{at}\} = \frac{1}{s - a}$` };
  }
  if (kind === 2) return { gtex: String(k), Gtex: `\\frac{${k}}{s}`, Gtext: `${k}/s`, rule: md`$\mathcal{L}\{1\} = \frac1s$` };
  if (kind === 3) return { gtex: coef(k, "t"), Gtex: `\\frac{${k}}{s^2}`, Gtext: `${k}/s^2`, rule: md`$\mathcal{L}\{t\} = \frac{1}{s^2}$` };
  const b = r.int(1, 3);
  const bt = `${b === 1 ? "" : b}t`;
  if (kind === 4) return { gtex: coef(k, `\\sin(${bt})`), Gtex: `\\frac{${k * b}}{s^2 + ${b * b}}`, Gtext: `${k * b}/(s^2 + ${b * b})`, rule: md`$\mathcal{L}\{\sin bt\} = \frac{b}{s^2 + b^2}$` };
  return { gtex: coef(k, `\\cos(${bt})`), Gtex: `\\frac{${k === 1 ? "" : k}s}{s^2 + ${b * b}}`, Gtext: `${k}s/(s^2 + ${b * b})`, rule: md`$\mathcal{L}\{\cos bt\} = \frac{s}{s^2 + b^2}$` };
}

const transformIVP: Generator = (r) => {
  const firstOrder = r.next() < 0.3;
  if (firstOrder) {
    const p = r.nonzero(-5, 5);
    const y0 = r.nonzero(-4, 4);
    const g = forcing(r, r.int(1, 5));
    const den = lin(-p);
    return {
      prompt: md`Take the Laplace transform of $${poly([[1, "y'"], [p, "y"]])} = ${g.gtex}$ with $y(0) = ${y0}$, and solve for $Y(s)$. Give $Y(s)$ as an expression in $s$, like (2 + 3/(s - 1))/(s + 4); don't invert it. Any equal form is accepted.`,
      answer: `(${y0} + ${g.Gtext})/(${den})`,
      positive: true,
      verify: [`(s Y - ${paren(y0)}) + ${paren(p)} Y = ${g.Gtext}`],
      hint: md`$\mathcal{L}\{y'\} = sY - y(0)$. Transform both sides, collect the $Y$ terms, and divide.`,
      solution: [
        { math: md`(sY - ${paren(y0)}) ${p < 0 ? "-" : "+"} ${Math.abs(p) === 1 ? "" : Math.abs(p)}Y = ${g.Gtex}`, note: md`Derivative rule on the left with $y(0) = ${y0}$. On the right, ${g.rule}.` },
        { math: md`(${den})Y = ${y0} + ${g.Gtex}`, note: md`Collect the $Y$ terms and move the initial value across.` },
        { math: md`Y(s) = \frac{${y0} + ${g.Gtex}}{${den}}`, note: "Divide. Inverting it would be the next step; here we stop at Y." },
      ],
    };
  }
  const p = r.int(-5, 5);
  const q = r.nonzero(-6, 8);
  const y0 = r.nonzero(-3, 3);
  const y1 = r.int(-4, 4);
  const g = r.next() < 0.5 ? null : forcing(r, r.int(1, 5));
  const den = poly([[1, "s^2"], [p, "s"], [q, ""]]);
  const numPoly = poly([[y0, "s"], [y1 + p * y0, ""]]);
  const numTex = g ? `${numPoly} + ${g.Gtex}` : numPoly;
  const answer = g ? `((${numPoly}) + ${g.Gtext})/(${den})` : `(${numPoly})/(${den})`;
  const lhs = poly([[1, "y''"], [p, "y'"], [q, "y"]]);
  const pTerm = p === 0 ? "" : ` ${p < 0 ? "-" : "+"} ${Math.abs(p) === 1 ? "" : Math.abs(p)}(sY - ${paren(y0)})`;
  return {
    prompt: md`Take the Laplace transform of $${lhs} = ${g ? g.gtex : 0}$ with $y(0) = ${y0}$ and $y'(0) = ${y1}$, and solve for $Y(s)$. Give $Y(s)$ as an expression in $s$, like (2s + 5)/(s^2 + 3s + 2) or (s + 4/(s - 1))/(s^2 + 9); don't invert it. Any equal form is accepted.`,
    answer,
    positive: true,
    verify: [`(s^2 Y - ${paren(y0)} s - ${paren(y1)}) + ${paren(p)} (s Y - ${paren(y0)}) + ${paren(q)} Y = ${g ? g.Gtext : 0}`],
    hint: md`$\mathcal{L}\{y''\} = s^2 Y - s\,y(0) - y'(0)$ and $\mathcal{L}\{y'\} = sY - y(0)$. Transform term by term, then collect everything with a $Y$ on one side.`,
    solution: [
      { math: md`(s^2 Y - ${paren(y0)}s - ${paren(y1)})${pTerm} ${q < 0 ? "-" : "+"} ${Math.abs(q) === 1 ? "" : Math.abs(q)}Y = ${g ? g.Gtex : 0}`, note: md`Derivative rules with $y(0) = ${y0}$, $y'(0) = ${y1}$.${g ? md` Right side: ${g.rule}.` : ""}` },
      { math: md`(${den})\,Y = ${numTex}`, note: md`Every $Y$ term goes left; the leftover numbers go right. Notice the left factor is the characteristic polynomial from Unit 3.` },
      { math: md`Y(s) = \frac{${numTex}}{${den}}`, note: "Divide. Partial fractions and the table would finish the job." },
    ],
  };
};

const solveIVP: Generator = (r) => {
  const kind = r.int(0, 2);
  const fmt = "Give $y(t)$ as an expression in $t$, like 2e^(2t) - e^(-t) or e^(-t)(cos(2t) + 3 sin(2t)). Any equal form is accepted.";
  if (kind === 0) {
    // Distinct real roots r1, r2: y = c1 e^{r1 t} + c2 e^{r2 t}.
    const r1 = r.int(-3, 3);
    let r2 = r.int(-3, 3);
    while (r2 === r1) r2 = r.int(-3, 3);
    const [c1, c2] = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
    const [p, q] = [-(r1 + r2), r1 * r2];
    const [y0, y1] = [c1 + c2, c1 * r1 + c2 * r2];
    const lhs = poly([[1, "y''"], [p, "y'"], [q, "y"]]);
    const num = poly([[y0, "s"], [y1 + p * y0, ""]]);
    const den = poly([[1, "s^2"], [p, "s"], [q, ""]]);
    const term = (c: number, rt: number, tex: boolean) => (rt === 0 ? String(c) : coef(c, tex ? eTex(rt) : eText(rt)));
    return {
      prompt: md`Use the Laplace transform to solve $${lhs} = 0$ with $y(0) = ${y0}$ and $y'(0) = ${y1}$. ${fmt}`,
      answer: join([term(c1, r1, false), term(c2, r2, false)]),
      hint: md`Transform to get $Y(s) = \frac{${num}}{${den}}$, factor the denominator as $(${lin(r1)})(${lin(r2)})$, split into partial fractions, and invert each piece with $\mathcal{L}\{e^{at}\} = \frac{1}{s - a}$.`,
      solution: [
        { math: md`(s^2 Y - ${paren(y0)}s - ${paren(y1)}) ${p === 0 ? "" : `${p < 0 ? "-" : "+"} ${Math.abs(p) === 1 ? "" : Math.abs(p)}(sY - ${paren(y0)})`} ${q < 0 ? "-" : "+"} ${Math.abs(q) === 1 ? "" : Math.abs(q)}Y = 0`, note: "Transform each term with the derivative rules; the initial values enter here." },
        { math: md`Y(s) = \frac{${num}}{${den}} = \frac{${num}}{(${lin(r1)})(${lin(r2)})}`, note: md`Collect the $Y$ terms and divide. The denominator is the characteristic polynomial, so it factors with the roots $${r1}$ and $${r2}$.` },
        { math: md`\frac{${num}}{(${lin(r1)})(${lin(r2)})} = \frac{${c1}}{${lin(r1)}} ${c2 < 0 ? "-" : "+"} \frac{${Math.abs(c2)}}{${lin(r2)}}`, note: md`Cover-up: at $s = ${r1}$, $A = \frac{${y0 * r1 + y1 + p * y0}}{${r1 - r2}} = ${c1}$; at $s = ${r2}$, $B = \frac{${y0 * r2 + y1 + p * y0}}{${r2 - r1}} = ${c2}$.` },
        { math: md`y(t) = ${join([term(c1, r1, true), term(c2, r2, true)])}`, note: md`Invert each piece. Check: $y(0) = ${c1} + ${paren(c2)} = ${y0}$.` },
      ],
    };
  }
  if (kind === 1) {
    // Complex roots a ± bi: y = e^{at}(c1 cos bt + c2 sin bt).
    const a = r.int(-2, 1);
    const b = r.int(1, 3);
    const [c1, c2] = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
    const [p, q] = [-2 * a, a * a + b * b];
    const [y0, y1] = [c1, a * c1 + b * c2];
    const lhs = poly([[1, "y''"], [p, "y'"], [q, "y"]]);
    const num = poly([[y0, "s"], [y1 + p * y0, ""]]);
    const den = poly([[1, "s^2"], [p, "s"], [q, ""]]);
    const sq = `(${lin(a)})^2 + ${b * b}`;
    const bt = `${b === 1 ? "" : b}t`;
    const inner = join([coef(c1, `\\cos(${bt})`), coef(c2, `\\sin(${bt})`)]);
    const innerText = join([coef(c1, `cos(${bt})`), coef(c2, `sin(${bt})`)]);
    return {
      prompt: md`Use the Laplace transform to solve $${lhs} = 0$ with $y(0) = ${y0}$ and $y'(0) = ${y1}$. ${fmt}`,
      answer: a === 0 ? innerText : `${eText(a)} (${innerText})`,
      hint: md`The denominator $${den}$ has no real roots. Complete the square: $${sq}$. Then write the numerator in terms of $${lin(a)}$ and use the shifting theorem with $e^{${a}t}$.`,
      solution: [
        { math: md`(s^2 Y - ${paren(y0)}s - ${paren(y1)}) ${p === 0 ? "" : `${p < 0 ? "-" : "+"} ${Math.abs(p) === 1 ? "" : Math.abs(p)}(sY - ${paren(y0)})`} + ${q}Y = 0`, note: "Transform with the derivative rules." },
        { math: md`Y(s) = \frac{${num}}{${den}} = \frac{${num}}{${sq}}`, note: md`Collect and divide, then complete the square: $s^2 ${p < 0 ? "-" : "+"} ${Math.abs(p)}s = (${lin(a)})^2 - ${a * a}$.` },
        { math: md`Y(s) = \frac{${coef(c1, `(${lin(a)})`)} ${c2 * b < 0 ? "-" : "+"} ${Math.abs(c2 * b)}}{${sq}} = ${c1 === 1 ? "" : `${c1} \\cdot `}\frac{${lin(a)}}{${sq}} ${c2 < 0 ? "-" : "+"} ${Math.abs(c2) === 1 ? "" : `${Math.abs(c2)} \\cdot `}\frac{${b}}{${sq}}`, note: md`Rewrite the numerator around $${lin(a)}$: $${num} = ${c1}(${lin(a)}) ${c2 * b < 0 ? "-" : "+"} ${Math.abs(c2 * b)}$. Then split so the sine piece has exactly $${b}$ on top.` },
        { math: md`y(t) = ${a === 0 ? inner : `${eTex(a)}\\left(${inner}\\right)`}`, note: md`$\frac{s - a}{(s - a)^2 + b^2}$ and $\frac{b}{(s - a)^2 + b^2}$ are the shifted cosine and sine lines: $\mathcal{L}\{e^{at}\cos bt\}$ and $\mathcal{L}\{e^{at}\sin bt\}$ with $a = ${a}$, $b = ${b}$.` },
      ],
    };
  }
  // Repeated root r0: y = (c1 + c2 t) e^{r0 t}.
  const r0 = r.nonzero(-3, 3);
  const [c1, c2] = [r.nonzero(-3, 3), r.nonzero(-3, 3)];
  const [p, q] = [-2 * r0, r0 * r0];
  const [y0, y1] = [c1, r0 * c1 + c2];
  const lhs = poly([[1, "y''"], [p, "y'"], [q, "y"]]);
  const num = poly([[y0, "s"], [y1 + p * y0, ""]]);
  const den = poly([[1, "s^2"], [p, "s"], [q, ""]]);
  const inner = poly([[c1, ""], [c2, "t"]]);
  return {
    prompt: md`Use the Laplace transform to solve $${lhs} = 0$ with $y(0) = ${y0}$ and $y'(0) = ${y1}$. ${fmt}`,
    answer: `(${inner}) ${eText(r0)}`,
    hint: md`The denominator is a perfect square, $(${lin(r0)})^2$. Split $Y$ as $\frac{A}{${lin(r0)}} + \frac{B}{(${lin(r0)})^2}$ and remember $\mathcal{L}\{t e^{at}\} = \frac{1}{(s - a)^2}$ from the shifting theorem.`,
    solution: [
      { math: md`(s^2 Y - ${paren(y0)}s - ${paren(y1)}) ${p < 0 ? "-" : "+"} ${Math.abs(p)}(sY - ${paren(y0)}) + ${q}Y = 0`, note: "Transform with the derivative rules." },
      { math: md`Y(s) = \frac{${num}}{${den}} = \frac{${num}}{(${lin(r0)})^2}`, note: "Collect and divide. The characteristic polynomial has one repeated root." },
      { math: md`Y(s) = \frac{${c1}}{${lin(r0)}} ${c2 < 0 ? "-" : "+"} \frac{${Math.abs(c2)}}{(${lin(r0)})^2}`, note: md`Write $${num} = ${c1}(${lin(r0)}) ${c2 < 0 ? "-" : "+"} ${Math.abs(c2)}$ and split.` },
      { math: md`y(t) = (${inner})${eTex(r0)}`, note: md`$\frac{1}{s - a} \to e^{at}$ and $\frac{1}{(s - a)^2} \to t e^{at}$, by shifting $\mathcal{L}\{t\} = \frac{1}{s^2}$. The $t e^{rt}$ of Unit 3 appears on its own.` },
    ],
  };
};

// ── Lesson 3: Step functions and impulses ───────────────────────────────────

const stepForcingTransform: Generator = (r) => {
  const two = r.next() < 0.4;
  const a = r.int(0, 6);
  let b = r.int(0, 8);
  while (b === a) b = r.int(0, 8);
  const c = r.int(1, 5);
  if (!two) {
    const jump = b - a;
    const stepTex = join([String(a), coef(jump, `u_{${c}}(t)`)]);
    const Ftex = join([a === 0 ? "" : `\\frac{${a}}{s}`, `\\frac{${jump === 1 ? "" : jump === -1 ? "-" : jump}e^{-${c}s}}{s}`]);
    return {
      prompt: md`A forcing function is $f(t) = ${a}$ for $0 \le t < ${c}$ and $f(t) = ${b}$ for $t \ge ${c}$. Write $f$ with a step function and find $F(s)$. Give $F(s)$ as an expression in $s$; type $e^{-${c}s}$ as e^(-${c}s). Any equal form is accepted.`,
      answer: join([a === 0 ? "" : `${a}/s`, `${jump} e^(-${c}s)/s`]),
      positive: true,
      // The derivative rule: f' is a jump of (b - a) at t = c, an impulse, and f(0) = a.
      verify: [`s F - ${a} = ${jump} e^(-${c} s)`],
      hint: md`Start at the value $${a}$, then add the jump at $t = ${c}$: $f(t) = ${a} + (${b} - ${a})\,u_{${c}}(t)$. Then $\mathcal{L}\{1\} = \frac1s$ and $\mathcal{L}\{u_c(t)\} = \frac{e^{-cs}}{s}$.`,
      solution: [
        { math: md`f(t) = ${stepTex}`, note: md`The function starts at $${a}$ and jumps by $${b} - ${a} = ${jump}$ at $t = ${c}$. A step function times the jump adds exactly that.` },
        { math: md`F(s) = ${Ftex}`, note: md`Linearity, with $\mathcal{L}\{1\} = \frac1s$ and $\mathcal{L}\{u_{${c}}(t)\} = \frac{e^{-${c}s}}{s}$.` },
      ],
    };
  }
  const c2 = c + r.int(1, 4);
  let d = r.int(0, 8);
  while (d === b) d = r.int(0, 8);
  const [j1, j2] = [b - a, d - b];
  const stepTex = join([String(a), coef(j1, `u_{${c}}(t)`), coef(j2, `u_{${c2}}(t)`)]);
  const eTerm = (j: number, cc: number) => `\\frac{${j === 1 ? "" : j === -1 ? "-" : j}e^{-${cc}s}}{s}`;
  return {
    prompt: md`A forcing function is $f(t) = ${a}$ for $0 \le t < ${c}$, $f(t) = ${b}$ for $${c} \le t < ${c2}$, and $f(t) = ${d}$ for $t \ge ${c2}$. Write $f$ with step functions and find $F(s)$. Give $F(s)$ as an expression in $s$; type $e^{-${c}s}$ as e^(-${c}s). Any equal form is accepted.`,
    answer: join([a === 0 ? "" : `${a}/s`, `${j1} e^(-${c}s)/s`, `${j2} e^(-${c2}s)/s`]),
    positive: true,
    verify: [`s F - ${a} = ${j1} e^(-${c} s) + ${paren(j2)} e^(-${c2} s)`],
    hint: md`Each jump gets its own step function: $f(t) = ${a} + (${b} - ${a})u_{${c}}(t) + (${d} - ${b})u_{${c2}}(t)$. Then transform term by term with $\mathcal{L}\{u_c(t)\} = \frac{e^{-cs}}{s}$.`,
    solution: [
      { math: md`f(t) = ${stepTex}`, note: md`Start at $${a}$. At $t = ${c}$ the value changes by $${j1}$; at $t = ${c2}$ it changes by $${j2}$. Each change is a step function times the size of the jump.` },
      { math: md`F(s) = ${join([a === 0 ? "" : `\\frac{${a}}{s}`, eTerm(j1, c), eTerm(j2, c2)])}`, note: md`$\mathcal{L}\{1\} = \frac1s$ and $\mathcal{L}\{u_c(t)\} = \frac{e^{-cs}}{s}$ for each $c$.` },
    ],
  };
};

const delayedTransform: Generator = (r) => {
  const c = r.int(1, 5);
  const k = r.nonzero(-5, 5);
  const kind = r.int(0, 6);
  const uc = `u_{${c}}(t)`;
  const E = `e^{-${c}s}`;
  const Et = `e^(-${c}s)`;
  const fmt = md`Give $F(s)$ as an expression in $s$; type $${E}$ as ${Et}. Any equal form is accepted.`;
  const shift = md`Second shifting theorem: $\mathcal{L}\{u_c(t) f(t - c)\} = e^{-cs}F(s)$.`;
  if (kind === 0) {
    return {
      prompt: md`Find the Laplace transform of $f(t) = ${coef(k, uc)}$. ${fmt}`,
      answer: `${k} ${Et}/s`,
      positive: true,
      verify: [`s F = ${k} e^(-${c} s)`],
      hint: md`$\mathcal{L}\{u_c(t)\} = \frac{e^{-cs}}{s}$: it is the transform of 1, delayed by $c$.`,
      solution: [{ math: md`F(s) = ${k === 1 ? "" : k === -1 ? "-" : k}\frac{${E}}{s}`, note: md`${shift} Here the delayed function is the constant 1, whose transform is $\frac1s$.` }],
    };
  }
  if (kind === 1 || kind === 2) {
    const n = kind;
    const body = n === 1 ? `(t - ${c})` : `(t - ${c})^2`;
    const top = k * fact(n);
    return {
      prompt: md`Find the Laplace transform of $f(t) = ${coef(k, `${uc}\\,${body}`)}$. ${fmt}`,
      answer: `${top} ${Et}/s^${n + 1}`,
      positive: true,
      verify: [`s^${n + 1} F = ${top} e^(-${c} s)`],
      hint: md`The function being switched on is $g(t) = t^{${n}}$, already written in $t - ${c}$. Transform $g$ and multiply by $e^{-${c}s}$.`,
      solution: [
        { math: md`g(t) = t${n === 1 ? "" : "^2"}, \qquad G(s) = \frac{${fact(n)}}{s^{${n + 1}}}`, note: md`$f(t) = ${coef(k, `u_{${c}}(t)\\,g(t - ${c})`)}$ with $\mathcal{L}\{t^n\} = \frac{n!}{s^{n + 1}}$.` },
        { math: md`F(s) = ${k === 1 ? "" : k === -1 ? "-" : k}\,${E} \cdot \frac{${fact(n)}}{s^{${n + 1}}} = \frac{${top}\,${E}}{s^{${n + 1}}}`, note: shift },
      ],
    };
  }
  if (kind === 3) {
    const a = r.nonzero(-3, 3);
    const body = `e^{${a === 1 ? "" : a === -1 ? "-" : a}(t - ${c})}`;
    return {
      prompt: md`Find the Laplace transform of $f(t) = ${coef(k, `${uc}\\,${body}`)}$. ${fmt}`,
      answer: `${k} ${Et}/(${lin(a)})`,
      positive: true,
      // f' = k delta_c + a f.
      verify: [`s F = ${k} e^(-${c} s) + ${a} F`],
      hint: md`The switched-on function is $g(t) = e^{${a}t}$ evaluated at $t - ${c}$. Transform $g$, then multiply by $e^{-${c}s}$.`,
      solution: [
        { math: md`g(t) = e^{${a}t}, \qquad G(s) = \frac{1}{${lin(a)}}`, note: md`The exponent is already written in $t - ${c}$, so $f(t) = ${coef(k, `u_{${c}}(t)\\,g(t - ${c})`)}$.` },
        { math: md`F(s) = \frac{${k === 1 ? "" : k === -1 ? "-" : k}${E}}{${lin(a)}}`, note: shift },
      ],
    };
  }
  if (kind === 4) {
    const b = r.int(1, 4);
    const body = `\\sin(${b === 1 ? "" : b}(t - ${c}))`;
    return {
      prompt: md`Find the Laplace transform of $f(t) = ${coef(k, `${uc}\\,${body}`)}$. ${fmt}`,
      answer: `${k * b} ${Et}/(s^2 + ${b * b})`,
      positive: true,
      // f'' = k b delta_c - b^2 f.
      verify: [`s^2 F = ${k * b} e^(-${c} s) - ${b * b} F`],
      hint: md`The switched-on function is $g(t) = \sin(${b}t)$ at $t - ${c}$. Transform $g$, then multiply by $e^{-${c}s}$.`,
      solution: [
        { math: md`g(t) = \sin(${b === 1 ? "" : b}t), \qquad G(s) = \frac{${b}}{s^2 + ${b * b}}`, note: md`$f(t) = ${coef(k, `u_{${c}}(t)\\,g(t - ${c})`)}$ and $\mathcal{L}\{\sin bt\} = \frac{b}{s^2 + b^2}$.` },
        { math: md`F(s) = \frac{${k * b}\,${E}}{s^2 + ${b * b}}`, note: shift },
      ],
    };
  }
  if (kind === 5) {
    // u_c(t) t: rewrite t = (t - c) + c.
    return {
      prompt: md`Find the Laplace transform of $f(t) = ${coef(k, `${uc}\\,t`)}$. The function multiplied by the step is not written in $t - ${c}$ yet. ${fmt}`,
      answer: `${k} ${Et} (1/s^2 + ${c}/s)`,
      positive: true,
      // f' = k c delta_c + k u_c.
      verify: [`s F = ${k * c} e^(-${c} s) + ${k} e^(-${c} s)/s`],
      hint: md`Write $t = (t - ${c}) + ${c}$, so the function switched on at $t = ${c}$ is $g(t) = t + ${c}$. Then use the shifting theorem on $g$.`,
      solution: [
        { math: md`t = (t - ${c}) + ${c} \;\Rightarrow\; f(t) = ${coef(k, `u_{${c}}(t)\\,g(t - ${c})`)}, \quad g(t) = t + ${c}`, note: md`The theorem needs the shape $u_c(t)\,g(t - c)$, so rewrite $t$ around $t - ${c}$.` },
        { math: md`G(s) = \frac{1}{s^2} + \frac{${c}}{s}`, note: md`$\mathcal{L}\{t\} = \frac{1}{s^2}$ and $\mathcal{L}\{${c}\} = \frac{${c}}{s}$.` },
        { math: md`F(s) = ${k === 1 ? "" : k === -1 ? "-" : k}\,${E}\left(\frac{1}{s^2} + \frac{${c}}{s}\right)`, note: shift },
      ],
    };
  }
  // u_c(t) e^{at}: rewrite e^{at} = e^{ac} e^{a(t - c)}.
  const a = r.nonzero(-2, 2);
  const ac = a * c;
  return {
    prompt: md`Find the Laplace transform of $f(t) = ${coef(k, `${uc}\\,${eTex(a)}`)}$. The exponential is not written in $t - ${c}$ yet; the answer may contain a number like $e^{${ac}}$, typed e^(${ac}). ${fmt}`,
    answer: `${k} e^(${ac}) ${Et}/(${lin(a)})`,
    positive: true,
    // f' = k e^{ac} delta_c + a f.
    verify: [`s F = ${k} e^(${ac}) e^(-${c} s) + ${a} F`],
    hint: md`Split the exponential: $e^{${a}t} = e^{${a}(t - ${c}) + ${ac}} = e^{${ac}}\,e^{${a}(t - ${c})}$. The constant $e^{${ac}}$ comes out in front.`,
    solution: [
      { math: md`${eTex(a)} = e^{${ac}}\,e^{${a}(t - ${c})} \;\Rightarrow\; f(t) = ${k === 1 ? "" : k === -1 ? "-" : k}e^{${ac}}\,u_{${c}}(t)\,e^{${a}(t - ${c})}`, note: md`Add and subtract $${ac}$ in the exponent so the function is in $t - ${c}$.` },
      { math: md`F(s) = \frac{${k === 1 ? "" : k === -1 ? "-" : k}e^{${ac}}\,${E}}{${lin(a)}}`, note: md`${shift} Here $g(t) = e^{${a}t}$ and $G(s) = \frac{1}{${lin(a)}}$; the constant $e^{${ac}}$ rides along.` },
    ],
  };
};

const stepIVP: Generator = (r) => {
  const kind = r.int(0, 2);
  const c = r.int(1, 4);
  if (kind === 0) {
    const p = r.int(1, 5);
    const k = r.int(1, 9);
    const f = frac(k, p);
    const exp = `e^(-${p === 1 ? "" : p}(t - ${c}))`;
    const expTex = `e^{-${p === 1 ? "" : p}(t - ${c})}`;
    return {
      prompt: md`Use the Laplace transform to solve $y' + ${p === 1 ? "" : p}y = ${k}u_{${c}}(t)$ with $y(0) = 0$. The solution is 0 before $t = ${c}$; give $y(t)$ for $t \ge ${c}$ as an expression in $t$, like (3/2)(1 - e^(-2(t - 3))). Any equal form is accepted.`,
      answer: `(${f})(1 - ${exp})`,
      hint: md`Transform: $(s + ${p})Y = \frac{${k}e^{-${c}s}}{s}$. Split $\frac{${k}}{s(s + ${p})}$ into partial fractions, invert, then the $e^{-${c}s}$ delays the result by $${c}$ and switches it on at $t = ${c}$.`,
      solution: [
        { math: md`sY + ${p === 1 ? "" : p}Y = \frac{${k}e^{-${c}s}}{s}`, note: md`$\mathcal{L}\{y'\} = sY - y(0) = sY$, and $\mathcal{L}\{u_{${c}}(t)\} = \frac{e^{-${c}s}}{s}$.` },
        { math: md`Y(s) = e^{-${c}s} \cdot \frac{${k}}{s(s + ${p})} = e^{-${c}s}\left(\frac{${fracTex(k, p)}}{s} - \frac{${fracTex(k, p)}}{s + ${p}}\right)`, note: md`Partial fractions on $H(s) = \frac{${k}}{s(s + ${p})}$: cover-up gives $\frac{${k}}{${p}}$ at $s = 0$ and $-\frac{${k}}{${p}}$ at $s = -${p}$.` },
        { math: md`h(t) = \mathcal{L}^{-1}\{H\} = ${fracTex(k, p)}\left(1 - e^{-${p === 1 ? "" : p}t}\right)`, note: "Invert the part without the exponential factor first." },
        { math: md`y(t) = u_{${c}}(t)\,h(t - ${c}) = u_{${c}}(t)\cdot ${fracTex(k, p)}\left(1 - ${expTex}\right)`, note: md`Second shifting theorem backwards: $e^{-${c}s}H(s)$ is the transform of $h$ delayed by $${c}$ and switched on there. For $t \ge ${c}$ the step is 1. Check: $y(${c}) = 0$, so the solution is continuous at the switch.` },
      ],
    };
  }
  const w = r.int(1, 4);
  if (kind === 1) {
    const k = r.int(1, 8);
    const f = frac(k, w);
    const wt = `${w === 1 ? "" : w}(t - ${c})`;
    return {
      prompt: md`Use the Laplace transform to solve $y'' + ${w * w}y = ${k}\delta(t - ${c})$ with $y(0) = 0$ and $y'(0) = 0$. The solution is 0 before $t = ${c}$; give $y(t)$ for $t \ge ${c}$ as an expression in $t$, like (1/2) sin(2(t - 1)). Any equal form is accepted.`,
      answer: `(${f}) sin(${wt})`,
      hint: md`$\mathcal{L}\{\delta(t - c)\} = e^{-cs}$, so $Y = \frac{${k}e^{-${c}s}}{s^2 + ${w * w}}$. Invert $\frac{${k}}{s^2 + ${w * w}}$ with the sine line, then delay by $${c}$.`,
      solution: [
        { math: md`s^2 Y + ${w * w}Y = ${k}e^{-${c}s}`, note: md`Both initial values are 0, so $\mathcal{L}\{y''\} = s^2 Y$. The impulse transforms to $${k}e^{-${c}s}$.` },
        { math: md`Y(s) = e^{-${c}s} \cdot \frac{${k}}{s^2 + ${w * w}} = e^{-${c}s} \cdot ${fracTex(k, w)} \cdot \frac{${w}}{s^2 + ${w * w}}`, note: md`The sine line needs $${w}$ on top, so factor out $\frac{${k}}{${w}}$.` },
        { math: md`y(t) = u_{${c}}(t)\cdot ${fracTex(k, w)}\sin(${wt})`, note: md`$\frac{${w}}{s^2 + ${w * w}}$ inverts to $\sin(${w === 1 ? "" : w}t)$; the factor $e^{-${c}s}$ delays it by $${c}$ and switches it on. Before $t = ${c}$ nothing has happened. The hammer blow at $t = ${c}$ sets the velocity to $${k}$ and the mass rings at its natural frequency.` },
      ],
    };
  }
  const k = r.int(1, 9);
  const f = frac(k, w * w);
  const wt = `${w === 1 ? "" : w}(t - ${c})`;
  return {
    prompt: md`Use the Laplace transform to solve $y'' + ${w * w}y = ${k}u_{${c}}(t)$ with $y(0) = 0$ and $y'(0) = 0$. The solution is 0 before $t = ${c}$; give $y(t)$ for $t \ge ${c}$ as an expression in $t$, like (3/4)(1 - cos(2(t - 1))). Any equal form is accepted.`,
    answer: `(${f})(1 - cos(${wt}))`,
    hint: md`$Y = \frac{${k}e^{-${c}s}}{s(s^2 + ${w * w})}$. Split $\frac{${k}}{s(s^2 + ${w * w})}$ as $\frac{A}{s} + \frac{Bs + C}{s^2 + ${w * w}}$, invert, then delay by $${c}$.`,
    solution: [
      { math: md`(s^2 + ${w * w})Y = \frac{${k}e^{-${c}s}}{s}`, note: md`Zero initial values make $\mathcal{L}\{y''\} = s^2 Y$; the step gives $\frac{${k}e^{-${c}s}}{s}$.` },
      { math: md`H(s) = \frac{${k}}{s(s^2 + ${w * w})} = \frac{${fracTex(k, w * w)}}{s} - \frac{${fracTex(k, w * w)}\,s}{s^2 + ${w * w}}`, note: md`Partial fractions: $A = \frac{${k}}{${w * w}}$ from $s = 0$; then $A + B = 0$ gives $B = -A$ and the $s$ coefficients give $C = 0$.` },
      { math: md`h(t) = ${fracTex(k, w * w)}\left(1 - \cos(${w === 1 ? "" : w}t)\right)`, note: md`Invert with $\frac1s \to 1$ and $\frac{s}{s^2 + ${w * w}} \to \cos(${w === 1 ? "" : w}t)$.` },
      { math: md`y(t) = u_{${c}}(t)\cdot ${fracTex(k, w * w)}\left(1 - \cos(${wt})\right)`, note: md`$Y = e^{-${c}s}H(s)$, so $y$ is $h$ delayed by $${c}$ and switched on at $t = ${c}$. After the switch the mass oscillates about the new equilibrium $\frac{${k}}{${w * w}}$ instead of about 0.` },
    ],
  };
};

// ── The unit ────────────────────────────────────────────────────────────────

export const unit4: Unit = {
  title: "Laplace Transforms",
  lessons: [
    {
      id: slug("The Laplace transform"),
      title: "The Laplace transform",
      summary: "An integral that turns a function of t into a function of s, and turns differentiation into multiplication by s. The table, derived line by line.",
      blocks: [
        {
          kind: "text",
          body: md`Unit 3 solved $ay'' + by' + cy = g(t)$ by guessing $e^{rt}$, then matching the forcing. That works when $g$ is a tidy formula. It struggles when $g$ is a switch flipped at $t = 3$, or a hammer blow at $t = 5$, and it never quite tells you *why* exponentials are the right guess.

The **Laplace transform** is a different route. It takes a function of $t$ and produces a function of a new variable $s$. Along the way, derivatives become multiplication by $s$, so a differential equation in $t$ becomes an algebra problem in $s$. We solve the algebra, then translate back. Unit 4 builds the tool; this lesson is the dictionary.`,
        },
        {
          kind: "key",
          title: "The Laplace transform",
          body: md`For a function $f(t)$ defined on $t \ge 0$, its **Laplace transform** is

$$F(s) = \mathcal{L}\{f\}(s) = \int_0^{\infty} e^{-st} f(t)\, dt = \lim_{T \to \infty} \int_0^{T} e^{-st} f(t)\, dt,$$

for every $s$ where the improper integral converges (Calculus 2, Unit 2). Lower-case letters are functions of $t$; the matching capital is the transform, a function of $s$. We write $\mathcal{L}\{f\}$ or $\mathcal{L}\{f(t)\}$ and $\mathcal{L}^{-1}\{F\}$ for going back.

The transform of a *function* is another function. The variable $t$ is integrated away; $s$ is left standing.`,
        },
        {
          kind: "why",
          title: "Why weight by e to the minus st",
          body: md`Two reasons, one about convergence and one about derivatives.

**Convergence.** Most functions we meet, polynomials, $e^{at}$, sines, grow no faster than some exponential: $|f(t)| \le M e^{kt}$. Multiply by $e^{-st}$ with $s > k$ and the product is squeezed under $M e^{-(s - k)t}$, which has a finite integral on $[0, \infty)$. So the weight tames the growth and the integral exists, at least for large enough $s$.

**Derivatives.** $e^{-st}$ is the function whose derivative is a constant multiple of itself: $\frac{d}{dt} e^{-st} = -s\,e^{-st}$. When we integrate $e^{-st} f'(t)$ by parts, the derivative moves off $f$ and onto $e^{-st}$, where it just produces a factor of $-s$. That is the whole trick: a derivative on $f$ becomes a multiplication by $s$ on $F$. We prove it below.`,
        },
        {
          kind: "plot",
          x: [0, 8],
          y: [-0.5, 3],
          curves: [
            { expr: "x", label: "f(t) = t", dashed: true, color: 2 },
            { expr: "x e^(-s x)", label: "e^{-st} f(t)", color: 1 },
          ],
          shade: [{ expr: "x e^(-s x)", from: 0, to: 8, color: 1 }],
          params: [{ name: "s", min: 0.5, max: 3, step: 0.25, value: 1 }],
          caption: md`The horizontal axis is $t$. The dashed line is $f(t) = t$; the solid curve is $e^{-st} f(t)$, and the shaded area under it is $F(s)$. Slide $s$: a larger $s$ crushes the tail sooner and the area shrinks. Here $F(s) = \frac{1}{s^2} = {=1/s^2}$, a formula we derive below.`,
        },
        {
          kind: "example",
          title: "The transform of 1",
          problem: md`Find $\mathcal{L}\{1\}$ from the definition.`,
          steps: [
            { math: md`\int_0^{T} e^{-st}\, dt = \left[-\frac{1}{s} e^{-st}\right]_0^{T} = \frac{1}{s} - \frac{1}{s} e^{-sT}`, note: md`Integrate up to $T$ first. We need $s \ne 0$ to divide.` },
            { math: md`\lim_{T \to \infty} \left(\frac{1}{s} - \frac{1}{s} e^{-sT}\right) = \frac{1}{s} \quad (s > 0)`, note: md`For $s > 0$, $e^{-sT} \to 0$. For $s < 0$ it blows up and the integral diverges; for $s = 0$ the integral is $\int_0^\infty 1\,dt$, also divergent.` },
            { math: md`\mathcal{L}\{1\} = \frac{1}{s}, \qquad s > 0`, note: "Every transform comes with a range of s. We usually leave it unsaid, but it is always there." },
          ],
        },
        {
          kind: "example",
          title: "The transform of an exponential",
          problem: md`Find $\mathcal{L}\{e^{at}\}$.`,
          steps: [
            { math: md`\int_0^{\infty} e^{-st} e^{at}\, dt = \int_0^{\infty} e^{-(s - a)t}\, dt`, note: "Combine the exponents. It is the previous integral with s replaced by s - a." },
            { math: md`= \frac{1}{s - a}, \qquad s > a`, note: md`The previous example with $s - a$ in place of $s$: converges exactly when $s - a > 0$.` },
          ],
        },
        {
          kind: "why",
          title: "Why the transform of t to the n is n factorial over s to the n plus 1",
          body: md`Integrate by parts with $u = t^n$ and $dv = e^{-st}\,dt$, so $du = n t^{n-1}\,dt$ and $v = -\frac1s e^{-st}$:

$$\int_0^{T} t^n e^{-st}\, dt = \left[-\frac{t^n e^{-st}}{s}\right]_0^{T} + \frac{n}{s}\int_0^{T} t^{n-1} e^{-st}\, dt.$$

As $T \to \infty$ the boundary term $-\frac{T^n e^{-sT}}{s}$ goes to 0 for $s > 0$: exponentials beat powers (Calculus 1, l'Hôpital $n$ times). At $t = 0$ it is 0 too. What is left is a **reduction formula**:

$$\mathcal{L}\{t^n\} = \frac{n}{s}\,\mathcal{L}\{t^{n-1}\}.$$

Each use knocks the power down by one and pays a factor $\frac{n}{s}$. Unwinding from $t^n$ down to $t^0 = 1$:

$$\mathcal{L}\{t^n\} = \frac{n}{s} \cdot \frac{n-1}{s} \cdots \frac{1}{s} \cdot \mathcal{L}\{1\} = \frac{n!}{s^n} \cdot \frac{1}{s} = \frac{n!}{s^{n+1}}.$$

So $\mathcal{L}\{t\} = \frac{1}{s^2}$, $\mathcal{L}\{t^2\} = \frac{2}{s^3}$, $\mathcal{L}\{t^3\} = \frac{6}{s^4}$. The factorial is the trace of the repeated parts.`,
        },
        {
          kind: "proof",
          title: "Linearity of the transform",
          given: md`$\mathcal{L}\{f\} = F$ and $\mathcal{L}\{g\} = G$ both exist for $s > k$; $a, b$ are constants`,
          prove: md`$\mathcal{L}\{af + bg\} = aF(s) + bG(s)$ for $s > k$`,
          steps: [
            { statement: md`$\int_0^{T} e^{-st}\,(af(t) + bg(t))\, dt = a\int_0^{T} e^{-st} f(t)\, dt + b\int_0^{T} e^{-st} g(t)\, dt$`, reason: "Integrals of sums and constant multiples (Calculus 1)" },
            { statement: md`The right side tends to $aF(s) + bG(s)$ as $T \to \infty$`, reason: "Both limits exist by hypothesis, and limits respect sums and constant multiples" },
            { statement: md`$\mathcal{L}\{af + bg\}(s) = aF(s) + bG(s)$`, reason: "Definition of the transform as that limit" },
          ],
        },
        {
          kind: "why",
          title: "Why sine and cosine have the transforms they do",
          body: md`Unit 3 gave us Euler's formula, $e^{ibt} = \cos bt + i\sin bt$. The exponential computation above never used that $a$ was real: with $a = ib$,

$$\int_0^{T} e^{-(s - ib)t}\, dt = \frac{1 - e^{-(s - ib)T}}{s - ib}, \qquad \left|e^{-(s - ib)T}\right| = e^{-sT} \to 0,$$

so $\mathcal{L}\{e^{ibt}\} = \frac{1}{s - ib}$ for $s > 0$. Clear the complex denominator with its conjugate:

$$\frac{1}{s - ib} = \frac{s + ib}{(s - ib)(s + ib)} = \frac{s}{s^2 + b^2} + i\,\frac{b}{s^2 + b^2}.$$

The integral of a complex-valued function is the integral of its real part plus $i$ times the integral of its imaginary part. By linearity, the real part of $\mathcal{L}\{e^{ibt}\}$ is $\mathcal{L}\{\cos bt\}$ and the imaginary part is $\mathcal{L}\{\sin bt\}$:

$$\mathcal{L}\{\cos bt\} = \frac{s}{s^2 + b^2}, \qquad \mathcal{L}\{\sin bt\} = \frac{b}{s^2 + b^2}.$$

Two integrations by parts give the same result without complex numbers, but this way shows why the two answers share a denominator: they are two halves of one exponential.`,
        },
        {
          kind: "key",
          title: "The table",
          body: md`$$\begin{array}{c|c} f(t) & F(s) = \mathcal{L}\{f\} \\ \hline 1 & \dfrac{1}{s} \\[6pt] t^n & \dfrac{n!}{s^{n+1}} \\[6pt] e^{at} & \dfrac{1}{s - a} \\[6pt] \sin bt & \dfrac{b}{s^2 + b^2} \\[6pt] \cos bt & \dfrac{s}{s^2 + b^2} \\[6pt] f'(t) & sF(s) - f(0) \\[6pt] f''(t) & s^2 F(s) - s f(0) - f'(0) \end{array}$$

With **linearity**, $\mathcal{L}\{af + bg\} = aF + bG$, these few lines cover every function we meet in this unit. Read them in both directions: left to right to transform, right to left to invert.`,
        },
        {
          kind: "proof",
          title: "The derivative rule",
          given: md`$f$ is continuous on $[0, \infty)$ with a piecewise continuous derivative, $|f(t)| \le M e^{kt}$, and $s > k$`,
          prove: md`$\mathcal{L}\{f'\}(s) = sF(s) - f(0)$`,
          steps: [
            { statement: md`$\int_0^{T} e^{-st} f'(t)\, dt = \left[e^{-st} f(t)\right]_0^{T} - \int_0^{T} (-s)e^{-st} f(t)\, dt$`, reason: md`Integration by parts with $u = e^{-st}$, $dv = f'(t)\,dt$, so $du = -s e^{-st}\,dt$, $v = f(t)$` },
            { statement: md`$= e^{-sT} f(T) - f(0) + s\int_0^{T} e^{-st} f(t)\, dt$`, reason: "Evaluate the bracket and pull the constant s out" },
            { statement: md`$\left|e^{-sT} f(T)\right| \le M e^{-(s - k)T} \to 0$ as $T \to \infty$`, reason: md`Exponential order of $f$ and $s > k$` },
            { statement: md`$\mathcal{L}\{f'\}(s) = -f(0) + sF(s)$`, reason: md`Let $T \to \infty$; the last integral tends to $F(s)$ by definition` },
          ],
        },
        {
          kind: "text",
          body: md`Apply the rule to $f'$ itself to get the second derivative: $\mathcal{L}\{f''\} = s\,\mathcal{L}\{f'\} - f'(0) = s(sF - f(0)) - f'(0) = s^2F - sf(0) - f'(0)$. Each derivative costs one factor of $s$ and leaves behind one initial value. That is exactly the shape an initial value problem needs, and it is why the Laplace transform fits them so well (next lesson).

The rule is also a quick check on the table. Take $f(t) = t^2$: then $f'' = 2$, $f(0) = 0$, $f'(0) = 0$, so $\mathcal{L}\{2\} = s^2 F(s)$. Since $\mathcal{L}\{2\} = \frac{2}{s}$, we get $F(s) = \frac{2}{s^3}$, matching the table. Or take $f = \sin bt$: $f'' = -b^2 f$ with $f(0) = 0$, $f'(0) = b$, so $s^2 F - b = -b^2 F$ and $F = \frac{b}{s^2 + b^2}$. The practice problems are checked this way behind the scenes.`,
        },
        {
          kind: "check",
          prompt: md`Find $\mathcal{L}\{3t^2 - 2e^{5t}\}$. ${S_FORMAT}`,
          answer: "6/s^3 - 2/(s - 5)",
          positive: true,
          explain: md`Linearity splits it: $3 \cdot \frac{2!}{s^3} - 2 \cdot \frac{1}{s - 5} = \frac{6}{s^3} - \frac{2}{s - 5}$, valid for $s > 5$.`,
        },
        {
          kind: "text",
          body: md`**When does the transform exist?** If $f$ is piecewise continuous on every $[0, T]$ and of **exponential order**, meaning $|f(t)| \le M e^{kt}$ for some constants $M$ and $k$, then $F(s)$ exists for every $s > k$. That is the convergence argument from the first why box, made official. Every function in the table qualifies; $e^{t^2}$ does not, and it has no transform.

One consequence worth knowing: for such $f$, $F(s) \to 0$ as $s \to \infty$, because $e^{-st}$ flattens everything. So a function like $\frac{s}{s + 1}$, which tends to 1, is *not* the transform of any ordinary function. Keep this in mind when inverting: the degree on top must be smaller than the degree below.`,
        },
        {
          kind: "key",
          title: "The inverse transform",
          body: md`If $\mathcal{L}\{f\} = F$, we write $f = \mathcal{L}^{-1}\{F\}$ and call $f$ the **inverse Laplace transform** of $F$. In practice we find it by reading the table right to left, after some algebra to make the pieces match.

This only makes sense if $F$ determines $f$. It does: two continuous functions with the same transform are the same function (Lerch's theorem; the proof needs more analysis than we have, so we take it as given). The inverse transform is linear too, since the transform is.`,
        },
        {
          kind: "example",
          title: "Inverting with constant adjustments",
          problem: md`Find $\mathcal{L}^{-1}\left\{\dfrac{2s + 3}{s^2 + 9}\right\}$.`,
          steps: [
            { math: md`\frac{2s + 3}{s^2 + 9} = 2 \cdot \frac{s}{s^2 + 9} + 3 \cdot \frac{1}{s^2 + 9}`, note: md`Split by linearity. The denominator $s^2 + 9$ says $b = 3$.` },
            { math: md`= 2 \cdot \frac{s}{s^2 + 9} + 1 \cdot \frac{3}{s^2 + 9}`, note: md`The sine line needs $b = 3$ on top. We have 3, so the coefficient is 1. Had the numerator been 5, we would write $\frac{5}{3} \cdot \frac{3}{s^2 + 9}$.` },
            { math: md`f(t) = 2\cos 3t + \sin 3t`, note: "Read the table backwards." },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $\mathcal{L}^{-1}\left\{\dfrac{4}{s^3}\right\}$. ${T_FORMAT}`,
          answer: "2t^2",
          explain: md`$\frac{1}{s^3}$ is $\frac{2!}{s^3}$ with a 2 missing, so $\frac{4}{s^3} = 2 \cdot \frac{2}{s^3} = 2\,\mathcal{L}\{t^2\}$. The inverse is $2t^2$.`,
        },
      ],
      practice: [transformSingle, transformSum, inverseBasic],
    },
    {
      id: slug("Solving initial value problems"),
      title: "Solving initial value problems",
      summary: "Transform the equation, solve for Y(s) by algebra, split into partial fractions, and read the table backwards. Initial conditions come along for free.",
      blocks: [
        {
          kind: "text",
          body: md`Here is the method in one breath. Transform both sides of the differential equation. The derivative rule turns $y'$ and $y''$ into $sY$ and $s^2Y$ with the initial values attached. Solve the resulting equation for $Y(s)$: that is just algebra. Then invert $Y$ to get $y(t)$.

The hard step is the last one, and it is the same every time: break a rational function into pieces that are in the table. That is partial fractions, from Calculus 2, Unit 2.`,
        },
        {
          kind: "key",
          title: "Transforms of derivatives",
          body: md`If $Y(s) = \mathcal{L}\{y\}$, then

$$\mathcal{L}\{y'\} = sY - y(0), \qquad \mathcal{L}\{y''\} = s^2 Y - s\,y(0) - y'(0).$$

Each derivative multiplies by $s$ and subtracts the initial data. Only the values at $t = 0$ appear, which is why the method is built for **initial** value problems.`,
        },
        {
          kind: "proof",
          title: "The second-derivative rule",
          given: md`$y$ and $y'$ both satisfy the conditions of the derivative rule from the previous lesson`,
          prove: md`$\mathcal{L}\{y''\} = s^2 Y - s\,y(0) - y'(0)$`,
          steps: [
            { statement: md`$\mathcal{L}\{y''\} = \mathcal{L}\{(y')'\} = s\,\mathcal{L}\{y'\} - y'(0)$`, reason: md`Derivative rule applied to the function $y'$` },
            { statement: md`$\mathcal{L}\{y'\} = sY - y(0)$`, reason: md`Derivative rule applied to $y$` },
            { statement: md`$\mathcal{L}\{y''\} = s(sY - y(0)) - y'(0) = s^2 Y - s\,y(0) - y'(0)$`, reason: "Substitute and distribute" },
          ],
        },
        {
          kind: "example",
          title: "A first-order equation, start to finish",
          problem: md`Solve $y' + 3y = 0$, $y(0) = 5$, with the Laplace transform.`,
          steps: [
            { math: md`(sY - 5) + 3Y = 0`, note: md`Transform both sides. $\mathcal{L}\{y'\} = sY - y(0)$ with $y(0) = 5$; $\mathcal{L}\{0\} = 0$.` },
            { math: md`(s + 3)Y = 5 \;\Rightarrow\; Y(s) = \frac{5}{s + 3}`, note: "Algebra: collect the Y terms and divide." },
            { math: md`y(t) = 5e^{-3t}`, note: md`Table, right to left: $\frac{1}{s - a}$ with $a = -3$. Unit 1 gave the same answer by separating variables, and the initial condition was handled without a separate step.` },
          ],
        },
        {
          kind: "why",
          title: "Why the denominator is always the characteristic polynomial",
          body: md`Transform $ay'' + by' + cy = g(t)$ with $y(0) = y_0$, $y'(0) = y_1$:

$$a(s^2 Y - sy_0 - y_1) + b(sY - y_0) + cY = G(s).$$

Collect the $Y$ terms: $(as^2 + bs + c)\,Y = G(s) + (as + b)y_0 + ay_1$. So

$$Y(s) = \frac{G(s) + (as + b)y_0 + ay_1}{as^2 + bs + c}.$$

The denominator is $as^2 + bs + c$, the characteristic polynomial of Unit 3. Its roots $r$ are the exponents in $e^{rt}$. Partial fractions will put a $\frac{1}{s - r}$ for each root, and each inverts to $e^{rt}$. So Unit 3's guess $y = e^{rt}$ is not a guess here: it falls out of the algebra. Complex roots give $(s - \alpha)^2 + \beta^2$ and the sines and cosines; a repeated root gives $(s - r)^2$ and the $te^{rt}$. And the initial values ride in the numerator, so the particular solution appears directly, never a general solution with constants to fit.`,
        },
        {
          kind: "example",
          title: "Complex roots without complex numbers",
          problem: md`Solve $y'' + 4y = 0$, $y(0) = 1$, $y'(0) = 2$.`,
          steps: [
            { math: md`(s^2 Y - s \cdot 1 - 2) + 4Y = 0`, note: md`$\mathcal{L}\{y''\} = s^2 Y - s\,y(0) - y'(0)$.` },
            { math: md`Y(s) = \frac{s + 2}{s^2 + 4}`, note: "Collect and divide." },
            { math: md`Y(s) = \frac{s}{s^2 + 4} + \frac{2}{s^2 + 4}`, note: md`Split into the cosine and sine shapes with $b = 2$. The sine line needs a 2 on top, and we have exactly 2.` },
            { math: md`y(t) = \cos 2t + \sin 2t`, note: md`Check: $y(0) = 1$ and $y'(0) = 2\cos 0 = 2$.` },
          ],
        },
        {
          kind: "plot",
          x: [0, 7],
          y: [-4, 4],
          curves: [{ expr: "a cos(2x) + (b/2) sin(2x)", label: "y(t)" }],
          points: [{ x: 0, y: "a", label: "(0, {a})", color: 2 }],
          params: [
            { name: "a", tex: "y(0)", min: -3, max: 3, step: 0.5, value: 1 },
            { name: "b", tex: "y'(0)", min: -4, max: 4, step: 0.5, value: 2 },
          ],
          caption: md`Solutions of $y'' + 4y = 0$ with the initial values on the sliders. In the $s$-domain this family is $Y(s) = \dfrac{{a}\,s + {b}}{s^2 + 4}$: the initial values sit in the numerator, the equation sits in the denominator.`,
        },
        {
          kind: "key",
          title: "Partial fractions, the three shapes",
          body: md`A proper rational function (degree on top smaller than below) splits according to the factors of its denominator:

- **Distinct linear factors**: $\dfrac{P(s)}{(s - a)(s - b)} = \dfrac{A}{s - a} + \dfrac{B}{s - b}$.
- **Repeated factor**: $\dfrac{P(s)}{(s - a)^2} = \dfrac{A}{s - a} + \dfrac{B}{(s - a)^2}$.
- **Irreducible quadratic**: $\dfrac{P(s)}{(s - a)(s^2 + k^2)} = \dfrac{A}{s - a} + \dfrac{Bs + C}{s^2 + k^2}$.

To find the constants, multiply through by the denominator and either substitute convenient values of $s$ or compare coefficients.`,
        },
        {
          kind: "why",
          title: "Why the cover-up method works",
          body: md`Take $\dfrac{P(s)}{(s - a)(s - b)} = \dfrac{A}{s - a} + \dfrac{B}{s - b}$. Multiply both sides by $(s - a)(s - b)$:

$$P(s) = A(s - b) + B(s - a).$$

This is an identity between polynomials, so it holds for *every* $s$, including $s = a$. At $s = a$ the $B$ term is multiplied by $a - a = 0$ and disappears, leaving $P(a) = A(a - b)$, so $A = \frac{P(a)}{a - b}$. In words: cover up the factor $(s - a)$ in the original fraction and evaluate what remains at $s = a$. Same for $B$ at $s = b$.

Why do the constants exist at all? Because the right side, over the common denominator, has numerator $A(s - b) + B(s - a)$, a linear polynomial with two free constants, and any linear $P(s)$ can be matched by choosing them: two unknowns, two coefficients to match. The other two shapes work the same way, with the counts arranged to come out even. For a repeated factor, $\frac{A}{s - a}$ alone would give only constant numerators over $(s - a)^2$; the extra $\frac{B}{(s - a)^2}$ supplies the second degree of freedom.`,
        },
        {
          kind: "example",
          title: "Distinct real roots",
          problem: md`Solve $y'' - y' - 2y = 0$, $y(0) = 1$, $y'(0) = 4$.`,
          steps: [
            { math: md`(s^2 Y - s - 4) - (sY - 1) - 2Y = 0`, note: "Transform each term; the initial values enter through the derivative rules." },
            { math: md`(s^2 - s - 2)Y = s + 3 \;\Rightarrow\; Y = \frac{s + 3}{(s - 2)(s + 1)}`, note: "Collect the Y terms. The denominator factors, as a characteristic polynomial with roots 2 and -1 should." },
            { math: md`\frac{s + 3}{(s - 2)(s + 1)} = \frac{A}{s - 2} + \frac{B}{s + 1}, \quad A = \frac{2 + 3}{2 + 1} = \frac53, \quad B = \frac{-1 + 3}{-1 - 2} = -\frac23`, note: "Cover-up: evaluate at s = 2 with the (s - 2) covered, then at s = -1 with the (s + 1) covered." },
            { math: md`y(t) = \frac53 e^{2t} - \frac23 e^{-t}`, note: md`Check: $y(0) = \frac53 - \frac23 = 1$ and $y'(0) = \frac{10}{3} + \frac23 = 4$.` },
          ],
        },
        {
          kind: "key",
          title: "The first shifting theorem",
          body: md`$$\mathcal{L}\{e^{at} f(t)\} = F(s - a).$$

Multiplying a function by $e^{at}$ shifts its transform by $a$. Read backwards: whenever you see $s - a$ where the table has $s$, the inverse picks up a factor $e^{at}$. In particular

$$\mathcal{L}\{e^{at}\cos bt\} = \frac{s - a}{(s - a)^2 + b^2}, \qquad \mathcal{L}\{e^{at}\sin bt\} = \frac{b}{(s - a)^2 + b^2}, \qquad \mathcal{L}\{t e^{at}\} = \frac{1}{(s - a)^2}.$$`,
        },
        {
          kind: "proof",
          title: "The first shifting theorem",
          given: md`$F(s) = \mathcal{L}\{f\}$ exists for $s > k$`,
          prove: md`$\mathcal{L}\{e^{at} f(t)\} = F(s - a)$ for $s > k + a$`,
          steps: [
            { statement: md`$\mathcal{L}\{e^{at} f(t)\} = \int_0^{\infty} e^{-st} e^{at} f(t)\, dt = \int_0^{\infty} e^{-(s - a)t} f(t)\, dt$`, reason: "Definition, then combine the exponents" },
            { statement: md`$\int_0^{\infty} e^{-(s - a)t} f(t)\, dt = F(s - a)$`, reason: md`This is the defining integral of $F$ with $s - a$ in the place of $s$; it converges when $s - a > k$` },
          ],
        },
        {
          kind: "why",
          title: "Why completing the square is the move for complex roots",
          body: md`When $s^2 + bs + c$ has no real roots, it does not factor over the reals, so there is no $\frac{A}{s - r}$ to aim for. But it always equals $(s - \alpha)^2 + \beta^2$ after completing the square (Algebra 1, Unit 8), with $\alpha = -\frac{b}{2}$ and $\beta^2 = c - \alpha^2 > 0$. That is the denominator of the shifted sine and cosine lines. So the recipe is:

- complete the square in the denominator;
- rewrite the numerator as $A(s - \alpha) + B\beta$, so each piece matches a shifted line;
- invert to $e^{\alpha t}(A\cos\beta t + B\sin\beta t)$.

A repeated root is the same idea with $\beta = 0$: $\frac{A}{s - r} + \frac{B}{(s - r)^2}$ inverts to $(A + Bt)e^{rt}$, since $\frac{1}{(s - r)^2}$ is $\mathcal{L}\{t\} = \frac{1}{s^2}$ shifted by $r$. Unit 3 needed reduction of order to find $te^{rt}$; here it is one line of the table.`,
        },
        {
          kind: "example",
          title: "Complex roots and the shift",
          problem: md`Solve $y'' + 2y' + 5y = 0$, $y(0) = 2$, $y'(0) = 0$.`,
          steps: [
            { math: md`(s^2 Y - 2s - 0) + 2(sY - 2) + 5Y = 0`, note: "Transform." },
            { math: md`(s^2 + 2s + 5)Y = 2s + 4 \;\Rightarrow\; Y = \frac{2s + 4}{(s + 1)^2 + 4}`, note: md`Collect, then complete the square: $s^2 + 2s + 5 = (s + 1)^2 + 4$, so $\alpha = -1$, $\beta = 2$.` },
            { math: md`Y = \frac{2(s + 1) + 2}{(s + 1)^2 + 4} = 2 \cdot \frac{s + 1}{(s + 1)^2 + 4} + 1 \cdot \frac{2}{(s + 1)^2 + 4}`, note: md`Write the numerator around $s + 1$: $2s + 4 = 2(s + 1) + 2$. The sine piece needs $\beta = 2$ on top.` },
            { math: md`y(t) = 2e^{-t}\cos 2t + e^{-t}\sin 2t`, note: md`Shifted cosine and sine lines with $a = -1$. Check: $y(0) = 2$; $y'(0) = -2 + 2 = 0$.` },
          ],
        },
        {
          kind: "example",
          title: "A forcing term",
          problem: md`Solve $y' - 2y = e^{3t}$, $y(0) = 0$.`,
          steps: [
            { math: md`sY - 2Y = \frac{1}{s - 3}`, note: md`The forcing transforms too: $\mathcal{L}\{e^{3t}\} = \frac{1}{s - 3}$.` },
            { math: md`Y = \frac{1}{(s - 2)(s - 3)} = \frac{-1}{s - 2} + \frac{1}{s - 3}`, note: md`Cover-up: at $s = 2$, $\frac{1}{2 - 3} = -1$; at $s = 3$, $\frac{1}{3 - 2} = 1$.` },
            { math: md`y(t) = e^{3t} - e^{2t}`, note: md`The $e^{3t}$ is the response to the forcing; the $e^{2t}$ is the homogeneous part, sized to make $y(0) = 0$. Both came out of one computation.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Transform $y'' + 3y' + 2y = 0$ with $y(0) = 1$, $y'(0) = 0$, and solve for $Y(s)$. Give $Y(s)$ as an expression in $s$, like (s + 3)/(s^2 + 3s + 2). Don't invert.`,
          answer: "(s + 3)/(s^2 + 3s + 2)",
          positive: true,
          explain: md`$(s^2 Y - s) + 3(sY - 1) + 2Y = 0$, so $(s^2 + 3s + 2)Y = s + 3$ and $Y = \frac{s + 3}{s^2 + 3s + 2}$.`,
        },
        {
          kind: "check",
          prompt: md`Finish it: find $\mathcal{L}^{-1}\left\{\dfrac{s + 3}{(s + 1)(s + 2)}\right\}$. Give $y(t)$ as an expression in $t$, like 3e^(-t) - 2e^(-2t).`,
          answer: "2e^(-t) - e^(-2t)",
          explain: md`Cover-up: at $s = -1$, $A = \frac{-1 + 3}{-1 + 2} = 2$; at $s = -2$, $B = \frac{-2 + 3}{-2 + 1} = -1$. So $y = 2e^{-t} - e^{-2t}$, and $y(0) = 1$, $y'(0) = -2 + 2 = 0$ as required.`,
        },
      ],
      practice: [partialFractions, transformIVP, solveIVP],
    },
    {
      id: slug("Step functions and impulses"),
      title: "Step functions and impulses",
      summary: "Switches that flip at a given time and blows that last an instant. The unit step, the second shifting theorem, and the delta function, with the transforms that make them easy.",
      blocks: [
        {
          kind: "text",
          body: md`Real forcing is rarely one formula for all time. A voltage is applied at $t = 2$ and removed at $t = 5$. A heater turns on. A hammer strikes a mass once, briefly. Undetermined coefficients (Unit 3) has nothing to say about such things, because they are not a single sum of exponentials and sines.

The Laplace transform handles them with one new function and one new theorem. The function is the **unit step**, which is 0 and then 1. The theorem says what multiplying a transform by $e^{-cs}$ does.`,
        },
        {
          kind: "key",
          title: "The unit step function",
          body: md`$$u_c(t) = \begin{cases} 0 & t < c \\ 1 & t \ge c \end{cases}$$

It is a switch that turns on at time $c$. With it, piecewise functions become single formulas:

- $g(t)\,u_c(t)$ is $g$ switched on at $t = c$ (zero before).
- $u_a(t) - u_b(t)$ is a pulse: 1 on $[a, b)$, 0 elsewhere.
- A function that is $A$ until $t = c$ and $B$ after is $A + (B - A)\,u_c(t)$: start at $A$, add the jump.

Every jump in a piecewise function becomes one step term, whose coefficient is the size of the jump.`,
        },
        {
          kind: "plot",
          x: [0, 10],
          y: [-1, 6],
          curves: [
            { expr: "2", domain: [0, 3], color: 1 },
            { expr: "5", domain: [3, 6], color: 1 },
            { expr: "0", domain: [6, 10], color: 1 },
          ],
          points: [
            { x: 3, y: 2, open: true, color: 1 },
            { x: 3, y: 5, color: 1 },
            { x: 6, y: 5, open: true, color: 1 },
            { x: 6, y: 0, color: 1 },
          ],
          caption: md`A forcing that is 2, then 5 from $t = 3$, then 0 from $t = 6$. Start at 2, jump by $+3$ at 3, jump by $-5$ at 6: $f(t) = 2 + 3u_3(t) - 5u_6(t)$.`,
        },
        {
          kind: "example",
          title: "The transform of a step",
          problem: md`Find $\mathcal{L}\{u_c(t)\}$ from the definition.`,
          steps: [
            { math: md`\int_0^{\infty} e^{-st} u_c(t)\, dt = \int_c^{\infty} e^{-st}\, dt`, note: md`The step is 0 before $c$ and 1 after, so the integral starts at $c$.` },
            { math: md`= \lim_{T \to \infty}\left[-\frac{e^{-st}}{s}\right]_c^{T} = \frac{e^{-cs}}{s}, \qquad s > 0`, note: md`Compare $\mathcal{L}\{1\} = \frac1s$: delaying the switch-on by $c$ multiplies the transform by $e^{-cs}$. That pattern is general.` },
          ],
        },
        {
          kind: "proof",
          title: "The second shifting theorem",
          given: md`$F(s) = \mathcal{L}\{f\}$ exists for $s > k$, and $c \ge 0$`,
          prove: md`$\mathcal{L}\{u_c(t)\,f(t - c)\} = e^{-cs} F(s)$`,
          steps: [
            { statement: md`$\int_0^{\infty} e^{-st} u_c(t) f(t - c)\, dt = \int_c^{\infty} e^{-st} f(t - c)\, dt$`, reason: md`$u_c$ is 0 on $[0, c)$ and 1 on $[c, \infty)$` },
            { statement: md`$= \int_0^{\infty} e^{-s(\tau + c)} f(\tau)\, d\tau$`, reason: md`Substitute $\tau = t - c$, $d\tau = dt$; when $t = c$, $\tau = 0$` },
            { statement: md`$= e^{-cs}\int_0^{\infty} e^{-s\tau} f(\tau)\, d\tau = e^{-cs} F(s)$`, reason: md`$e^{-s(\tau + c)} = e^{-cs} e^{-s\tau}$, and $e^{-cs}$ does not depend on $\tau$; the remaining integral is $F(s)$` },
          ],
        },
        {
          kind: "why",
          title: "Why e to the minus cs means delay",
          body: md`The function $u_c(t)\,f(t - c)$ is the graph of $f$ slid $c$ units to the right, with nothing before $t = c$: the same signal, started later. The theorem says this delay shows up in the transform as a factor $e^{-cs}$ and nothing else.

Read it backwards and you have an inversion rule. If a transform is $e^{-cs}$ times something you can invert, say $e^{-cs}H(s)$ with $\mathcal{L}^{-1}\{H\} = h$, then

$$\mathcal{L}^{-1}\{e^{-cs} H(s)\} = u_c(t)\,h(t - c).$$

Take the ordinary inverse, replace every $t$ by $t - c$, and switch it on at $c$.

One trap. The theorem wants $f(t - c)$, a function of $t - c$. If a problem hands you $u_c(t)\,g(t)$ with $g$ written in plain $t$, first rewrite $g$ around $t - c$: for example $u_2(t)\,t = u_2(t)\,[(t - 2) + 2]$, so $f(\tau) = \tau + 2$ and the transform is $e^{-2s}\left(\frac{1}{s^2} + \frac{2}{s}\right)$. Likewise $u_c(t)\,e^{at} = e^{ac}\,u_c(t)\,e^{a(t - c)}$.`,
        },
        {
          kind: "example",
          title: "A switch flipped at t = 2",
          problem: md`Solve $y' + y = 3u_2(t)$, $y(0) = 0$. (A tank starts clean; at $t = 2$ an inflow begins.)`,
          steps: [
            { math: md`sY + Y = \frac{3e^{-2s}}{s}`, note: md`$\mathcal{L}\{u_2(t)\} = \frac{e^{-2s}}{s}$, times 3.` },
            { math: md`Y = e^{-2s} \cdot \frac{3}{s(s + 1)} = e^{-2s}\left(\frac{3}{s} - \frac{3}{s + 1}\right)`, note: md`Keep the $e^{-2s}$ aside and split what remains: $H(s) = \frac{3}{s(s + 1)}$, with $A = 3$ at $s = 0$ and $B = -3$ at $s = -1$.` },
            { math: md`h(t) = 3 - 3e^{-t}`, note: md`Invert $H$ as usual.` },
            { math: md`y(t) = u_2(t)\,h(t - 2) = u_2(t)\left(3 - 3e^{-(t - 2)}\right)`, note: md`Delay by 2 and switch on. For $t < 2$ the solution is 0; after that it climbs toward 3 exactly as it would have from $t = 0$, just two units later.` },
          ],
        },
        {
          kind: "plot",
          x: [0, 8],
          y: [-0.5, 3.5],
          curves: [
            { expr: "0", domain: [0, 2], label: "y(t)", color: 1 },
            { expr: "3 - 3e^(-(x - 2))", domain: [2, 8], color: 1 },
            { expr: "3 - 3e^(-x)", dashed: true, color: 2, label: "h(t)" },
          ],
          hlines: [{ y: 3 }],
          vlines: [{ x: 2, label: "t = 2" }],
          caption: md`The dashed curve is $h(t) = 3 - 3e^{-t}$, the response to a switch at $t = 0$. The solid curve is $y = u_2(t)\,h(t - 2)$: the same response, delayed two units. The factor $e^{-2s}$ in $Y(s)$ is that delay.`,
        },
        {
          kind: "key",
          title: "The unit impulse",
          body: md`A blow at time $c$ delivers a finite push in a vanishingly short time. Model it as a tall narrow pulse of total area 1,

$$d_\tau(t) = \frac{1}{2\tau}\left(u_{c - \tau}(t) - u_{c + \tau}(t)\right), \qquad \int_{-\infty}^{\infty} d_\tau(t)\, dt = 1,$$

and let $\tau \to 0$. The limit is the **delta function** $\delta(t - c)$: zero everywhere except at $t = c$, with total integral 1. It is not a function in the ordinary sense, but it behaves consistently inside integrals:

$$\int_{-\infty}^{\infty} \delta(t - c)\, g(t)\, dt = g(c), \qquad \mathcal{L}\{\delta(t - c)\} = e^{-cs}.$$

In $my'' + ky = F_0\,\delta(t - c)$ it is a hammer hit at time $c$ with impulse $F_0$: an instant change of momentum by $F_0$.`,
        },
        {
          kind: "plot",
          x: [0, 6],
          y: [0, 6],
          curves: [{ expr: "((x - 3 + a)/abs(x - 3 + a) - (x - 3 - a)/abs(x - 3 - a))/(4a)", label: "d_\\tau(t)", color: 1 }],
          params: [{ name: "a", tex: "\\tau", min: 0.1, max: 1, step: 0.05, value: 0.5 }],
          caption: md`The pulse $d_\tau(t)$ centered at $c = 3$: width $2\tau = {=2a}$, height $\frac{1}{2\tau} = {=1/(2a)}$, area always 1. Slide $\tau$ toward 0 to see it approach the impulse.`,
        },
        {
          kind: "why",
          title: "Why the transform of the impulse is e to the minus cs",
          body: md`Transform the pulse with the step formula. For $\tau < c$,

$$\mathcal{L}\{d_\tau\} = \frac{1}{2\tau}\left(\frac{e^{-(c - \tau)s}}{s} - \frac{e^{-(c + \tau)s}}{s}\right) = e^{-cs}\,\frac{e^{\tau s} - e^{-\tau s}}{2\tau s} = e^{-cs}\,\frac{\sinh(\tau s)}{\tau s}.$$

Now let $\tau \to 0$. From the series in Unit 3, $\sinh x = x + \frac{x^3}{3!} + \cdots$, so $\frac{\sinh x}{x} = 1 + \frac{x^2}{6} + \cdots \to 1$ as $x \to 0$ (or use l'Hôpital). Hence

$$\mathcal{L}\{\delta(t - c)\} = \lim_{\tau \to 0} \mathcal{L}\{d_\tau\} = e^{-cs}.$$

The same limit gives the sampling property: $\int d_\tau(t) g(t)\, dt$ is the average of $g$ over $[c - \tau, c + \tau]$, which tends to $g(c)$ for continuous $g$. With $g(t) = e^{-st}$ that is $e^{-cs}$ again, as it must be.`,
        },
        {
          kind: "why",
          title: "Why the impulse is the derivative of the step",
          body: md`The step $u_c$ is flat except for a jump of 1 at $t = c$. Its derivative is 0 everywhere else, and at the jump it must be "infinitely steep with total rise 1", which is exactly $\delta(t - c)$. The transforms agree with this: the derivative rule says

$$\mathcal{L}\{u_c'\} = s\,\mathcal{L}\{u_c\} - u_c(0) = s \cdot \frac{e^{-cs}}{s} - 0 = e^{-cs} = \mathcal{L}\{\delta(t - c)\}.$$

Turned around, this is a check on every transform in this lesson: a function with a jump of size $J$ at $t = c$ has a derivative containing $J\,\delta(t - c)$, so $sF(s) - f(0)$ must contain $J e^{-cs}$. The practice answers are verified this way.`,
        },
        {
          kind: "example",
          title: "A hammer blow",
          problem: md`Solve $y'' + 4y = \delta(t - 1)$, $y(0) = 0$, $y'(0) = 0$: a mass at rest is struck at $t = 1$.`,
          steps: [
            { math: md`s^2 Y + 4Y = e^{-s}`, note: md`Zero initial values, and $\mathcal{L}\{\delta(t - 1)\} = e^{-s}$.` },
            { math: md`Y = e^{-s} \cdot \frac{1}{s^2 + 4} = e^{-s} \cdot \frac12 \cdot \frac{2}{s^2 + 4}`, note: "The sine line wants a 2 on top." },
            { math: md`y(t) = \tfrac12\,u_1(t)\,\sin(2(t - 1))`, note: md`Nothing happens until $t = 1$. Then the mass oscillates at its natural frequency, starting from rest position with velocity $y'(1^+) = 1$: the blow changed the velocity by exactly the impulse.` },
          ],
        },
        {
          kind: "plot",
          x: [0, 8],
          y: [-1, 1],
          curves: [
            { expr: "0", domain: [0, 1], label: "y(t)", color: 1 },
            { expr: "(1/2) sin(2(x - 1))", domain: [1, 8], color: 1 },
          ],
          vlines: [{ x: 1, label: "t = 1" }],
          caption: md`The response to a unit impulse at $t = 1$: at rest, then a sudden kick into oscillation. The slope jumps from 0 to 1 at the blow while the position stays continuous.`,
        },
        {
          kind: "check",
          prompt: md`Find $\mathcal{L}\{u_3(t)\,(t - 3)^2\}$. Give $F(s)$ as an expression in $s$; type $e^{-3s}$ as e^(-3s).`,
          answer: "2e^(-3s)/s^3",
          positive: true,
          explain: md`The function switched on at 3 is $t^2$, written in $t - 3$ already. $\mathcal{L}\{t^2\} = \frac{2}{s^3}$, so the answer is $e^{-3s} \cdot \frac{2}{s^3}$.`,
        },
        {
          kind: "check",
          prompt: md`Find $\mathcal{L}^{-1}\left\{\dfrac{e^{-4s}}{s + 2}\right\}$ for $t \ge 4$ (it is 0 before). Give it as an expression in $t$, like e^(-3(t - 1)).`,
          answer: "e^(-2(t - 4))",
          explain: md`Without the $e^{-4s}$, $\frac{1}{s + 2}$ inverts to $e^{-2t}$. The factor delays it by 4: $u_4(t)\,e^{-2(t - 4)}$.`,
        },
      ],
      practice: [stepForcingTransform, delayedTransform, stepIVP],
    },
  ],
};
