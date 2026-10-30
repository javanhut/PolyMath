import { frac, fracTex, gcd, paren, poly, signed } from "../../math/random";
import { md, slug, type DiagramSpec, type Generator, type Lesson, type SeriesColor, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

const pt = (x: number | string, y: number | string) => `(${x}, ${y})`;
/** (x - h) as text or LaTeX: "x", "(x - 2)", "(x + 3)". */
const sh = (v: string, h: number) => (h === 0 ? v : `(${v} ${signed(-h)})`);
/** c times a bracketed expression: "4(y - 1)", "-(y - 1)", "(y - 1)", "8y". */
const times = (c: number, inner: string) => (c === 1 ? inner.replace(/^\((.*)\)$/, "$1") : c === -1 ? `-${inner}` : `${c}${inner}`);
/** (x - h)^2 over a denominator, dropping the fraction when the denominator is 1. */
const over = (v: string, h: number, den: number) => (den === 1 ? `${sh(v, h)}^2` : `\\frac{${sh(v, h)}^2}{${den}}`);
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** sqrt(n) for a positive integer n, simplified: 20 -> 2sqrt(5). */
function root(n: number): { text: string; tex: string; exact: boolean; value: number } {
  let k = 1;
  let m = n;
  for (let d = 2; d * d <= m; d++) {
    while (m % (d * d) === 0) {
      m /= d * d;
      k *= d;
    }
  }
  if (m === 1) return { text: String(k), tex: String(k), exact: true, value: k };
  const coef = k === 1 ? "" : String(k);
  return { text: `${coef}sqrt(${m})`, tex: `${coef}\\sqrt{${m}}`, exact: false, value: Math.sqrt(n) };
}

/** h + sign * sqrt(c2), as typed text and LaTeX. */
function offset(h: number, c2: number, sign: 1 | -1): { text: string; tex: string } {
  const rt = root(c2);
  if (rt.exact) {
    const v = h + sign * rt.value;
    return { text: String(v), tex: String(v) };
  }
  const op = sign < 0 ? "-" : "+";
  if (h === 0) return { text: `${sign < 0 ? "-" : ""}${rt.text}`, tex: `${sign < 0 ? "-" : ""}${rt.tex}` };
  return { text: `${h} ${op} ${rt.text}`, tex: `${h} ${op} ${rt.tex}` };
}

/** A curve drawn as many short segments between hidden points (diagrams have no curves). */
function polyline(prefix: string, pts: [number | string, number | string][], color: SeriesColor): { points: NonNullable<DiagramSpec["points"]>; segments: NonNullable<DiagramSpec["segments"]> } {
  const points = pts.map(([x, y], i) => ({ name: `${prefix}${i}`, x, y, hidden: true, label: "" }));
  const segments = pts.slice(1).map((_, i) => ({ from: `${prefix}${i}`, to: `${prefix}${i + 1}`, color }));
  return { points, segments };
}

/** Ax^2 + Bxy + Cy^2 + Dx + Ey + F = 0 in LaTeX; with root3 the xy coefficient is B sqrt(3). */
function conicTex(A: number, B: number, C: number, D: number, E: number, F: number, root3 = false): string {
  const terms: string[] = [];
  const push = (c: number, v: string, rt = false) => {
    if (c === 0) return;
    const mag = Math.abs(c);
    const coef = mag === 1 && (v || rt) ? "" : String(mag);
    const body = `${coef}${rt ? "\\sqrt{3}" : ""}${v}`;
    terms.push(terms.length === 0 ? (c < 0 ? `-${body}` : body) : c < 0 ? ` - ${body}` : ` + ${body}`);
  };
  push(A, "x^2");
  push(B, "xy", root3);
  push(C, "y^2");
  push(D, "x");
  push(E, "y");
  push(F, "");
  return `${terms.join("") || "0"} = 0`;
}

type Axes = { a: number; b: number };
/** Semi-axes a > b; c^2 = a^2 - b^2. */
const ELLIPSES: Axes[] = [[5, 4], [5, 3], [13, 12], [13, 5], [10, 8], [10, 6], [3, 2], [4, 3], [2, 1], [3, 1], [4, 2], [5, 2], [6, 4], [7, 5], [6, 2]].map(([a, b]) => ({ a: a!, b: b! }));
const SMALL_ELLIPSES = ELLIPSES.filter((e) => e.a <= 6);
const INTEGER_ELLIPSES = ELLIPSES.filter((e) => root(e.a * e.a - e.b * e.b).exact);
/** Transverse a, conjugate b; c^2 = a^2 + b^2. */
const HYPERBOLAS: Axes[] = [[3, 4], [4, 3], [5, 12], [12, 5], [6, 8], [8, 6], [2, 1], [1, 2], [3, 2], [2, 3], [4, 2], [2, 4], [3, 1], [1, 3], [1, 1], [2, 2], [3, 3], [4, 1], [5, 2]].map(([a, b]) => ({ a: a!, b: b! }));
const SMALL_HYPERBOLAS = HYPERBOLAS.filter((e) => e.a <= 6 && e.b <= 6);
const INTEGER_HYPERBOLAS = HYPERBOLAS.filter((e) => root(e.a * e.a + e.b * e.b).exact);

const stdEllipse = (h: number, k: number, ux: number, uy: number) => md`${over("x", h, ux)} + ${over("y", k, uy)} = 1`;
const stdHyperbola = (h: number, k: number, horizontal: boolean, a2: number, b2: number) =>
  horizontal ? md`${over("x", h, a2)} - ${over("y", k, b2)} = 1` : md`${over("y", k, a2)} - ${over("x", h, b2)} = 1`;

// ── Lesson 1: Parabolas ─────────────────────────────────────────────────────

const FOUR_P = [-12, -8, -6, -4, -2, -1, 1, 2, 4, 6, 8, 12, 16];

const parabolaFeatures: Generator = (r) => {
  const vertical = r.next() < 0.5;
  const h = r.int(-5, 5);
  const k = r.int(-5, 5);
  const fourP = r.pick(FOUR_P);
  const kind = r.int(0, 2);
  const eq = vertical ? md`${sh("x", h)}^2 = ${times(fourP, sh("y", k))}` : md`${sh("y", k)}^2 = ${times(fourP, sh("x", h))}`;
  const pTex = fracTex(fourP, 4);
  const pText = frac(fourP, 4);
  const q = (n: number) => frac(n, 4);
  const qT = (n: number) => fracTex(n, 4);
  const opens = vertical ? (fourP > 0 ? "up" : "down") : fourP > 0 ? "right" : "left";
  // "+ p" and "- p" with the sign of p folded in, so a negative p reads "- 1/2", not "+ -1/2".
  const absP = fracTex(Math.abs(fourP), 4);
  const plusP = `${fourP < 0 ? "-" : "+"} ${absP}`;
  const minusP = `${fourP < 0 ? "+" : "-"} ${absP}`;
  const read: Step = {
    math: eq,
    note: md`The squared variable is $${vertical ? "x" : "y"}$, so the axis is ${vertical ? "vertical" : "horizontal"} and the parabola opens ${opens}. The vertex is $(h, k) = ${pt(h, k)}$, and $4p = ${fourP}$, so $p = ${pTex}$.`,
  };
  // Focus and directrix in quarters, so fractional p stays exact.
  const focus = vertical ? [String(h), q(4 * k + fourP)] : [q(4 * h + fourP), String(k)];
  const focusTex = vertical ? [String(h), qT(4 * k + fourP)] : [qT(4 * h + fourP), String(k)];
  const dir = vertical ? q(4 * k - fourP) : q(4 * h - fourP);
  const dirTex = vertical ? qT(4 * k - fourP) : qT(4 * h - fourP);
  const dirVar = vertical ? "y" : "x";

  if (kind === 0) {
    return {
      prompt: md`Find the vertex of the parabola $${eq}$. Give it as a point, like (2, -3).`,
      answer: pt(h, k),
      form: "tuple",
      verify: vertical
        ? [`(a - ${paren(h)})^2 = ${fourP}(b - ${paren(k)})`, `(a - ${paren(h)})^2 + (b - (${q(4 * k + fourP)}))^2 = (${pText})^2`]
        : [`(b - ${paren(k)})^2 = ${fourP}(a - ${paren(h)})`, `(a - (${q(4 * h + fourP)}))^2 + (b - ${paren(k)})^2 = (${pText})^2`],
      hint: md`Match the equation to $(x - h)^2 = 4p(y - k)$ or $(y - k)^2 = 4p(x - h)$. Watch the signs: $(x + 3)$ means $h = -3$.`,
      solution: [read, { math: md`V = ${pt(h, k)}`, note: "The vertex is the point that makes both sides zero." }],
    };
  }
  if (kind === 1) {
    return {
      prompt: md`Find the focus of the parabola $${eq}$. Give it as a point, like (2, -3). Fractions are fine, like (1/2, 3).`,
      answer: pt(focus[0]!, focus[1]!),
      form: "tuple",
      verify: vertical
        ? [
            `(x - (${q(4 * h + 2 * fourP)}))^2 + (y - (${q(4 * k + fourP)}))^2 = (${fourP})^2/4`,
            `(x - (${h + fourP}))^2 + (y - (${k + fourP}))^2 = 25(${fourP})^2/16`,
          ]
        : [
            `(x - (${q(4 * h + fourP)}))^2 + (y - (${q(4 * k + 2 * fourP)}))^2 = (${fourP})^2/4`,
            `(x - (${h + fourP}))^2 + (y - (${k + fourP}))^2 = 25(${fourP})^2/16`,
          ],
      hint: md`Find the vertex and $p$ first. The focus is $|p|$ from the vertex along the axis, on the side the parabola opens toward: $(h, k + p)$ for a vertical axis, $(h + p, k)$ for a horizontal one.`,
      solution: [
        read,
        {
          math: vertical ? md`F = (h, k + p) = (${h}, ${k} ${plusP})` : md`F = (h + p, k) = (${h} ${plusP}, ${k})`,
          note: md`Move $p = ${pTex}$ from the vertex along the axis. A negative $p$ moves ${vertical ? "down" : "left"}, which is the way the parabola opens.`,
        },
        { math: md`F = ${pt(focusTex[0]!, focusTex[1]!)}`, note: "" },
      ],
    };
  }
  return {
    prompt: md`Find the directrix of the parabola $${eq}$. It is the line $${dirVar} = c$; give the number $c$. Fractions are fine, like -3/2.`,
    answer: dir,
    verify: vertical
      ? [`abs(${q(4 * k + fourP)} - c) = abs(${fourP})/2`, `abs(${k + fourP} - c) = 5abs(${fourP})/4`]
      : [`abs(${q(4 * h + fourP)} - c) = abs(${fourP})/2`, `abs(${h + fourP} - c) = 5abs(${fourP})/4`],
    hint: md`The directrix is $|p|$ from the vertex on the side **away** from the focus: $y = k - p$ for a vertical axis, $x = h - p$ for a horizontal one.`,
    solution: [
      read,
      {
        math: vertical ? md`y = k - p = ${k} ${minusP}` : md`x = h - p = ${h} ${minusP}`,
        note: md`The vertex is halfway between the focus and the directrix, so the directrix is $p$ on the other side.`,
      },
      { math: md`${dirVar} = ${dirTex}`, note: "" },
    ],
  };
};

const parabolaGeneralForm: Generator = (r) => {
  const vertical = r.next() < 0.5;
  const h = r.nonzero(-5, 5);
  const k = r.int(-5, 5);
  const fourP = r.pick([-12, -8, -4, -2, 2, 4, 8, 12, 16]);
  const p = fourP / 4;
  // (x - h)^2 = 4p(y - k)  <=>  x^2 - 2hx - 4py + h^2 + 4pk = 0, and the same with x and y swapped.
  const [s, o] = vertical ? ["x", "y"] : ["y", "x"];
  const [sh0, oh0] = vertical ? [h, k] : [k, h]; // the squared variable's shift, the other's
  const D = -2 * sh0;
  const E = -fourP;
  const F = sh0 * sh0 + fourP * oh0;
  const eq = md`${poly([[1, `${s}^2`], [D, s], [E, o], [F, ""]])} = 0`;
  const half = -sh0;
  const rhsConst = sh0 * sh0 - F; // after adding h^2 to both sides: -E o + (h^2 - F)
  const target = vertical ? md`(x - h)^2 = 4p(y - k)` : md`(y - k)^2 = 4p(x - h)`;
  // Three points on the curve, read off the general equation, must fit the standard form.
  const verify = [0, 1, -1].map((v) => {
    const N = v * v + D * v + F; // the other variable solves E * other = -N
    const other = `(${frac(-N, E)})`;
    return vertical ? `(${v} - a)^2 = 4c(${other} - b)` : `(${v} - b)^2 = 4c(${other} - a)`;
  });
  return {
    prompt: md`Write $${eq}$ in the form $${target}$ and give $(h, k, p)$ as a tuple, like (2, -1, 3/2).`,
    answer: `(${h}, ${k}, ${frac(fourP, 4)})`,
    form: "tuple",
    verify,
    hint: md`Only $${s}$ is squared, so complete the square in $${s}$: move the $${o}$-term and the constant to the right first.`,
    solution: [
      { math: md`${poly([[1, `${s}^2`], [D, s]])} = ${poly([[-E, o], [-F, ""]])}`, note: md`Keep the $${s}$-terms on the left; everything else goes right.` },
      {
        math: md`${poly([[1, `${s}^2`], [D, s], [half * half, ""]])} = ${poly([[-E, o], [rhsConst, ""]])}`,
        note: md`Half of $${D}$ is $${half}$, and $(${half})^2 = ${half * half}$. Add it to both sides.`,
      },
      {
        math: md`${sh(s, sh0)}^2 = ${times(-E, sh(o, oh0))}`,
        note: md`The left side is a perfect square. On the right, factor out $${-E}$: $${poly([[-E, o], [rhsConst, ""]])} = ${times(-E, sh(o, oh0))}$.`,
      },
      { math: md`h = ${h}, \quad k = ${k}, \quad 4p = ${fourP} \;\Rightarrow\; p = ${fracTex(fourP, 4)}`, note: md`Vertex $${pt(h, k)}$, opening ${vertical ? (p > 0 ? "up" : "down") : p > 0 ? "right" : "left"}.` },
    ],
  };
};

const parabolaFromData: Generator = (r) => {
  const vertical = r.next() < 0.5;
  const h = r.int(-5, 5);
  const k = r.int(-5, 5);
  const fourP = r.pick([-12, -8, -6, -4, -2, 2, 4, 6, 8, 12]);
  const q = (n: number) => frac(n, 4);
  const qT = (n: number) => fracTex(n, 4);
  const pTex = qT(fourP);
  const target = vertical ? md`(x - h)^2 = 4p(y - k)` : md`(y - k)^2 = 4p(x - h)`;
  const answer = `(${h}, ${k}, ${q(fourP)})`;
  // Focus and directrix as quarters.
  const f = vertical ? [4 * h, 4 * k + fourP] : [4 * h + fourP, 4 * k];
  const d = vertical ? 4 * k - fourP : 4 * h - fourP;
  const fTex = pt(qT(f[0]!), qT(f[1]!));
  const fText = [q(f[0]!), q(f[1]!)];
  const dirVar = vertical ? "y" : "x";
  const dTexP = d < 0 ? `(${qT(d)})` : qT(d);
  const finish: Step[] = [
    { math: vertical ? md`${sh("x", h)}^2 = ${times(fourP, sh("y", k))}` : md`${sh("y", k)}^2 = ${times(fourP, sh("x", h))}`, note: md`$4p = ${fourP}$.` },
    { math: md`(h, k, p) = (${h}, ${k}, ${pTex})`, note: "" },
  ];
  if (r.next() < 0.5) {
    const verify = vertical
      ? [
          `(a - (${fText[0]}))^2 + (b - (${fText[1]}))^2 = c^2`,
          `(a - (${fText[0]}))^2 + (b - (${q(d)}))^2 = c^2`,
          `((${fText[0]}) + 2c - a)^2 = 4c((${fText[1]}) - b)`,
        ]
      : [
          `(a - (${fText[0]}))^2 + (b - (${fText[1]}))^2 = c^2`,
          `(a - (${q(d)}))^2 + (b - (${fText[1]}))^2 = c^2`,
          `((${fText[1]}) + 2c - b)^2 = 4c((${fText[0]}) - a)`,
        ];
    return {
      prompt: md`A parabola has focus $${fTex}$ and directrix $${dirVar} = ${qT(d)}$. Write its equation as $${target}$ and give $(h, k, p)$ as a tuple, like (2, -1, 3/2).`,
      answer,
      form: "tuple",
      verify,
      hint: md`The vertex is halfway between the focus and the directrix, and $p$ is the signed distance from the vertex to the focus.`,
      solution: [
        {
          math: vertical ? md`k = \frac{${qT(f[1]!)} + ${dTexP}}{2} = ${k}, \quad h = ${h}` : md`h = \frac{${qT(f[0]!)} + ${dTexP}}{2} = ${h}, \quad k = ${k}`,
          note: md`The directrix is ${vertical ? "horizontal" : "vertical"}, so the axis is ${vertical ? "vertical" : "horizontal"}. The vertex sits midway between the focus and the directrix, on the axis through the focus.`,
        },
        {
          math: vertical ? md`p = ${qT(f[1]!)} - ${paren(k)} = ${pTex}` : md`p = ${qT(f[0]!)} - ${paren(h)} = ${pTex}`,
          note: md`From the vertex to the focus. ${fourP > 0 ? "Positive: the parabola opens toward the focus, " + (vertical ? "up." : "right.") : "Negative: the focus is " + (vertical ? "below" : "left of") + " the vertex, so the parabola opens that way."}`,
        },
        ...finish,
      ],
    };
  }
  const verify = vertical
    ? [`(${h} - a)^2 = 4c(${k} - b)`, `((${fText[0]}) - a)^2 + ((${fText[1]}) - b - c)^2 = 0`, `(${h} - a)^2 + (${k} - b - c)^2 = (${k} - b + c)^2`]
    : [`(${k} - b)^2 = 4c(${h} - a)`, `((${fText[0]}) - a - c)^2 + ((${fText[1]}) - b)^2 = 0`, `(${k} - b)^2 + (${h} - a - c)^2 = (${h} - a + c)^2`];
  return {
    prompt: md`A parabola has vertex $${pt(h, k)}$ and focus $${fTex}$. Write its equation as $${target}$ and give $(h, k, p)$ as a tuple, like (2, -1, 3/2).`,
    answer,
    form: "tuple",
    verify,
    hint: md`$p$ is the signed distance from the vertex to the focus along the axis. The focus and vertex share ${vertical ? "an $x$" : "a $y$"}-coordinate, so the axis is ${vertical ? "vertical" : "horizontal"}.`,
    solution: [
      {
        math: vertical ? md`p = ${qT(f[1]!)} - ${paren(k)} = ${pTex}` : md`p = ${qT(f[0]!)} - ${paren(h)} = ${pTex}`,
        note: md`The focus is directly ${vertical ? (fourP > 0 ? "above" : "below") : fourP > 0 ? "right of" : "left of"} the vertex, so the axis is ${vertical ? "vertical" : "horizontal"} and $p$ is the ${vertical ? "vertical" : "horizontal"} gap, with its sign.`,
      },
      ...finish,
    ],
  };
};

const parabolaLocus: DiagramSpec = (() => {
  const xs = Array.from({ length: 41 }, (_, i) => r3(-5 + i * 0.25));
  const curve = polyline("C", xs.map((x) => [x, `${r3(x * x)}/(4p)`]), 1);
  return {
    view: [-7, 7, -4, 7],
    grid: true,
    params: [
      { name: "p", tex: md`p`, min: 1, max: 3, step: 0.5, value: 1.5 },
      { name: "s", tex: md`x\text{-coordinate of } P`, min: -5, max: 5, step: 0.25, value: 3 },
    ],
    points: [
      ...curve.points,
      { name: "F", x: 0, y: "p", label: md`F(0, p)`, dir: "e" },
      { name: "P", x: "s", y: "s^2/(4p)", dir: "ne" },
      { name: "D", x: "s", y: "-p", dir: "s" },
      { name: "L0", x: -7, y: "-p", hidden: true, label: "" },
      { name: "L1", x: 7, y: "-p", hidden: true, label: "" },
    ],
    segments: [...curve.segments, { from: "L0", to: "L1", kind: "line", color: 2 }, { from: "P", to: "F", color: 3 }, { from: "P", to: "D", color: 4, dashed: true }],
    labels: [{ x: 5.6, y: "-p - 0.5", text: md`y = -p` }],
    readouts: [
      { label: md`PF`, value: "sqrt(s^2 + (s^2/(4p) - p)^2)" },
      { label: md`PD`, value: "s^2/(4p) + p" },
    ],
    caption: md`Slide $P$ along the curve: its distance to the focus $F$ (green) always equals its distance to the directrix (dashed red). Slide $p$: the focus and directrix move apart and the parabola widens.`,
  };
})();

const parabolasLesson: Lesson = {
  id: slug("Parabolas"),
  title: "Parabolas",
  summary: "A parabola as the points equidistant from a focus and a directrix, the equation that rule forces, and how to read p.",
  blocks: [
    {
      kind: "text" as const,
      body: md`Slice a cone with a plane and the edge of the cut is a **conic section**: a circle, an ellipse, a parabola or a hyperbola, depending on the tilt. That is where the name comes from, but it is a hard definition to compute with. This unit uses a different one for each curve, a rule about distances, and every equation in the unit is derived from one of those rules.

We start with the parabola. You know it as the graph of $y = ax^2 + bx + c$. Now you will see what it really is.`,
    },
    {
      kind: "key" as const,
      title: "Parabola",
      body: md`Fix a point $F$ (the **focus**) and a line not through $F$ (the **directrix**). The parabola is the set of all points $P$ that are the same distance from $F$ as from the directrix:

$$PF = PD,$$

where $D$ is the foot of the perpendicular from $P$ to the directrix. The point halfway between the focus and the directrix is the **vertex**, and the line through the focus perpendicular to the directrix is the **axis of symmetry**.`,
    },
    { kind: "diagram" as const, ...parabolaLocus },
    {
      kind: "text" as const,
      body: md`To turn the rule into an equation, place the picture conveniently: vertex at the origin, focus at $(0, p)$ and directrix $y = -p$. The number $p$ is the distance from the vertex to the focus (and to the directrix). Let $P = (x, y)$ be any point on the parabola.`,
    },
    {
      kind: "proof" as const,
      title: "The equation of a parabola",
      given: md`Focus $F(0, p)$ with $p \ne 0$, directrix $y = -p$, and a point $P(x, y)$ with $PF = PD$`,
      prove: md`$x^2 = 4py$`,
      steps: [
        { statement: md`$PF = \sqrt{x^2 + (y - p)^2}$`, reason: "Distance formula (Geometry, Unit 5)." },
        { statement: md`$PD = |y + p|$`, reason: md`The foot of the perpendicular is $D = (x, -p)$, directly below or above $P$, so the distance is the vertical gap.` },
        { statement: md`$\sqrt{x^2 + (y - p)^2} = |y + p|$`, reason: "Definition of the parabola." },
        { statement: md`$x^2 + (y - p)^2 = (y + p)^2$`, reason: "Square both sides. Both sides are distances, so neither is negative and no solutions are gained or lost." },
        { statement: md`$x^2 + y^2 - 2py + p^2 = y^2 + 2py + p^2$`, reason: "Expand both squares." },
        { statement: md`$x^2 = 4py$`, reason: md`Subtract $y^2 + p^2$ from both sides, then add $2py$.` },
      ],
    },
    {
      kind: "why" as const,
      title: "Why squaring was safe",
      body: md`Squaring an equation can add false solutions: $x = 2$ becomes $x^2 = 4$, which $-2$ also satisfies. That happens when the two sides can have opposite signs. Here both sides are distances, so neither is negative, and two nonnegative numbers with equal squares are equal. Every step of the proof reverses, so $x^2 = 4py$ describes exactly the points of the parabola and nothing else.`,
    },
    {
      kind: "why" as const,
      title: "Why p is the right number to track",
      body: md`Solve for $y$: the equation is $y = \frac{1}{4p}x^2$, the familiar $y = ax^2$ with $a = \frac{1}{4p}$. So the parabola $y = ax^2$ you have graphed since Algebra 1 has a focus at $\left(0, \frac{1}{4a}\right)$ and directrix $y = -\frac{1}{4a}$.

A small $|p|$ puts the focus close to the vertex and makes $a$ large: a steep, narrow parabola. A large $|p|$ gives a wide one. The sign of $p$ says which way it opens. If $p < 0$ the focus is below the vertex, and the parabola opens down toward it. A parabola always wraps around its focus.`,
    },
    {
      kind: "key" as const,
      title: "Standard forms",
      body: md`Shifting the vertex to $(h, k)$ replaces $x$ by $x - h$ and $y$ by $y - k$ (Algebra 2, transformations):

- **Vertical axis:** $(x - h)^2 = 4p(y - k)$. Vertex $(h, k)$, focus $(h, k + p)$, directrix $y = k - p$. Opens up if $p > 0$, down if $p < 0$.
- **Horizontal axis:** $(y - k)^2 = 4p(x - h)$. Vertex $(h, k)$, focus $(h + p, k)$, directrix $x = h - p$. Opens right if $p > 0$, left if $p < 0$.

The squared variable tells you the axis: $x$ squared means a vertical axis. The chord through the focus perpendicular to the axis (the **latus rectum**) has length $|4p|$, which gives two more points for a sketch.`,
    },
    {
      kind: "why" as const,
      title: "Why the width at the focus is |4p|",
      body: md`In $(x - h)^2 = 4p(y - k)$, put $y = k + p$, the height of the focus. Then $(x - h)^2 = 4p^2$, so $x - h = \pm 2p$: the curve is $2|p|$ either side of the axis, $4|p|$ across.

Check it against the definition. The point $(h + 2p, k + p)$ is $2|p|$ from the focus $(h, k + p)$, and its distance to the directrix $y = k - p$ is $(k + p) - (k - p) = 2p$, the same size. Equal, as the rule demands.`,
    },
    {
      kind: "plot" as const,
      x: [-8, 8],
      y: [-6, 6],
      parametric: [{ x: "h + 2p t", y: "k + p t^2", t: [-4, 4], label: "(x - h)^2 = 4p(y - k)" }],
      points: [
        { x: "h", y: "k + p", label: "F", color: 2 },
        { x: "h", y: "k", label: "V", color: 3 },
      ],
      hlines: [{ y: "k - p", label: "y = k - p" }],
      vlines: [{ x: "h", label: "x = h" }],
      params: [
        { name: "h", min: -4, max: 4, step: 1, value: 1 },
        { name: "k", min: -3, max: 3, step: 1, value: -1 },
        { name: "p", min: -3, max: 3, step: 0.5, value: 1 },
      ],
      caption: md`Slide $p$ through zero: the focus crosses the vertex, the directrix crosses it the other way, and the parabola flips. Slide $h$ and $k$: the whole picture moves with the vertex and nothing else changes.`,
    },
    {
      kind: "example" as const,
      title: "Reading a standard form",
      problem: md`Find the vertex, focus and directrix of $(x + 1)^2 = -8(y - 3)$.`,
      steps: [
        { math: md`(x - (-1))^2 = 4p(y - 3), \quad 4p = -8`, note: md`$x$ is squared, so the axis is vertical. $h = -1$, $k = 3$.` },
        { math: md`p = -2`, note: "Negative: the parabola opens down." },
        { math: md`V = (-1, 3), \quad F = (h, k + p) = (-1, 1)`, note: "The focus is 2 below the vertex." },
        { math: md`y = k - p = 3 - (-2) = 5`, note: "The directrix is 2 above the vertex, on the other side." },
      ],
    },
    {
      kind: "example" as const,
      title: "From general form",
      problem: md`Find the vertex, focus and directrix of $y^2 - 6y - 4x + 1 = 0$.`,
      steps: [
        { math: md`y^2 - 6y = 4x - 1`, note: md`Only $y$ is squared, so the axis is horizontal. Keep the $y$-terms on the left.` },
        { math: md`y^2 - 6y + 9 = 4x + 8`, note: "Complete the square: half of 6 is 3, and 9 goes on both sides." },
        { math: md`(y - 3)^2 = 4(x + 2)`, note: md`Factor the 4 out of the right side.` },
        { math: md`V = (-2, 3), \quad p = 1, \quad F = (-1, 3), \quad x = -3`, note: md`$4p = 4$. The focus is 1 to the right of the vertex, the directrix 1 to the left.` },
      ],
    },
    {
      kind: "example" as const,
      title: "From focus and directrix",
      problem: md`Write the equation of the parabola with focus $(3, 1)$ and directrix $y = -3$.`,
      steps: [
        { math: md`V = \left(3, \frac{1 + (-3)}{2}\right) = (3, -1)`, note: "The vertex is halfway between the focus and the directrix, on the vertical line through the focus." },
        { math: md`p = 1 - (-1) = 2`, note: "From the vertex up to the focus: 2 units. Positive, so it opens up." },
        { math: md`(x - 3)^2 = 8(y + 1)`, note: md`$4p = 8$, with $h = 3$ and $k = -1$.` },
      ],
    },
    {
      kind: "text" as const,
      body: md`Why engineers care about the focus: a ray leaving the focus bounces off the parabola parallel to the axis, and a ray arriving parallel to the axis bounces to the focus. That is a fact about tangent lines, and calculus proves it. It is why satellite dishes, headlights and telescope mirrors are parabolas.`,
    },
    {
      kind: "check" as const,
      prompt: md`Find the focus of $x^2 = 12y$. Give it as a point, like (0, 3).`,
      answer: "(0, 3)",
      form: "tuple" as const,
      explain: md`$4p = 12$, so $p = 3$. The vertex is the origin and the axis is vertical, so the focus is $(0, 3)$.`,
    },
    {
      kind: "check" as const,
      prompt: md`The parabola $y = \frac{1}{8}(x - 1)^2 + 2$ can be written as $(x - 1)^2 = 4p(y - 2)$. Find $p$.`,
      answer: "2",
      explain: md`Subtract 2 and multiply by 8: $(x - 1)^2 = 8(y - 2)$. So $4p = 8$ and $p = 2$. The focus is $(1, 4)$.`,
    },
  ],
  practice: [parabolaFeatures, parabolaGeneralForm, parabolaFromData],
};

// ── Lesson 2: Ellipses ──────────────────────────────────────────────────────

const ellipseFeatures: Generator = (r) => {
  const { a, b } = r.pick(ELLIPSES);
  const c2 = a * a - b * b;
  const c = root(c2);
  const horizontal = r.next() < 0.5;
  const centered = r.next() < 0.3;
  const h = centered ? 0 : r.int(-4, 4);
  const k = centered ? 0 : r.int(-4, 4);
  const [ux, uy] = horizontal ? [a * a, b * b] : [b * b, a * a];
  const multiplied = centered && r.next() < 0.5;
  const g = gcd(ux, uy);
  const eq = multiplied ? md`${poly([[uy / g, "x^2"], [ux / g, "y^2"]])} = ${(ux * uy) / g}` : stdEllipse(h, k, ux, uy);
  const kind = r.int(0, 3);
  const steps: Step[] = [];
  if (multiplied) steps.push({ math: stdEllipse(0, 0, ux, uy), note: md`Divide by ${(ux * uy) / g} so the right side is 1.` });
  steps.push({
    math: md`a^2 = ${a * a}, \quad b^2 = ${b * b}, \quad a = ${a}, \quad b = ${b}`,
    note: md`The larger denominator is $a^2$. It sits under $${horizontal ? "x" : "y"}$, so the major axis is ${horizontal ? "horizontal" : "vertical"}. The center is $${pt(h, k)}$.`,
  });
  const P = (x: string | number, y: string | number) => pt(x, y);
  if (kind === 0) {
    return {
      prompt: md`Find the center of the ellipse $${eq}$. Give it as a point, like (2, -3).`,
      answer: pt(h, k),
      form: "tuple",
      verify: [
        `((a + 1 - ${paren(h)})^2)/${ux} + ((b - ${paren(k)})^2)/${uy} = ((a - 1 - ${paren(h)})^2)/${ux} + ((b - ${paren(k)})^2)/${uy}`,
        `((a - ${paren(h)})^2)/${ux} + ((b + 1 - ${paren(k)})^2)/${uy} = ((a - ${paren(h)})^2)/${ux} + ((b - 1 - ${paren(k)})^2)/${uy}`,
      ],
      hint: md`Match $(x - h)^2$ and $(y - k)^2$. Remember $(x + 3)^2$ means $h = -3$.`,
      solution: [...steps, { math: md`\text{center } ${pt(h, k)}`, note: "The point that makes both squared terms zero." }],
    };
  }
  if (kind === 1) {
    const V = horizontal ? [h + a, k] : [h, k + a];
    return {
      prompt: md`Find the vertex of the ellipse $${eq}$ with the larger $${horizontal ? "x" : "y"}$-coordinate. Give it as a point, like (2, -3).`,
      answer: P(V[0]!, V[1]!),
      form: "tuple",
      verify: [`((x - ${paren(h)})^2)/${ux} + ((y - ${paren(k)})^2)/${uy} = 1`, `(x - ${paren(h)})^2 + (y - ${paren(k)})^2 = ${a * a}`],
      hint: md`The vertices are the ends of the major axis, $a$ from the center along the direction of the larger denominator.`,
      solution: [...steps, { math: horizontal ? md`V = (h + a, k) = ${P(V[0]!, V[1]!)}` : md`V = (h, k + a) = ${P(V[0]!, V[1]!)}`, note: md`Move $a = ${a}$ from the center along the major axis.` }],
    };
  }
  if (kind === 2) {
    const F = horizontal ? [offset(h, c2, 1).text, String(k)] : [String(h), offset(k, c2, 1).text];
    const FT = horizontal ? [offset(h, c2, 1).tex, String(k)] : [String(h), offset(k, c2, 1).tex];
    const covs = horizontal ? [[h, k + b], [h, k - b]] : [[h + b, k], [h - b, k]];
    return {
      prompt: md`Find the focus of the ellipse $${eq}$ with the larger $${horizontal ? "x" : "y"}$-coordinate. Give it as a point, like (2, -3)${c.exact ? "" : " or (1 + sqrt(5), 2)"}.`,
      answer: P(F[0]!, F[1]!),
      form: "tuple",
      verify: covs.map(([cx, cy]) => `(x - ${paren(cx!)})^2 + (y - ${paren(cy!)})^2 = ${a * a}`),
      hint: md`$c^2 = a^2 - b^2$. The foci are $c$ from the center along the major axis.`,
      solution: [
        ...steps,
        { math: md`c^2 = a^2 - b^2 = ${a * a} - ${b * b} = ${c2}, \quad c = ${c.tex}`, note: md`$a$, $b$, $c$ form a right triangle with $a$ as hypotenuse.` },
        { math: horizontal ? md`F = (h + c, k) = ${P(FT[0]!, FT[1]!)}` : md`F = (h, k + c) = ${P(FT[0]!, FT[1]!)}`, note: "Along the major axis, inside the ellipse." },
      ],
    };
  }
  const e = c.exact ? frac(c.value, a) : `${c.text}/${a}`;
  const eTex = c.exact ? fracTex(c.value, a) : md`\frac{${c.tex}}{${a}}`;
  return {
    prompt: md`Find the eccentricity $e = \frac{c}{a}$ of the ellipse $${eq}$. Give the exact value, like 3/5 or sqrt(5)/3.`,
    answer: e,
    verify: [`(q*${a})^2 + ${b * b} = ${a * a}`],
    hint: md`First find $c$ from $c^2 = a^2 - b^2$. Then divide by $a$, the semi-major axis.`,
    solution: [...steps, { math: md`c = \sqrt{${a * a} - ${b * b}} = ${c.tex}`, note: "" }, { math: md`e = \frac{c}{a} = ${eTex}`, note: md`Between 0 and 1, as it must be: $c < a$.` }],
  };
};

const PARAM_T = ["pi/6", "2pi/3", "5pi/4", "7pi/4"];

const ellipseGeneralForm: Generator = (r) => {
  const { a, b } = r.pick(SMALL_ELLIPSES);
  const horizontal = r.next() < 0.5;
  const h = r.nonzero(-4, 4);
  const k = r.nonzero(-4, 4);
  const [ux, uy] = horizontal ? [a * a, b * b] : [b * b, a * a];
  const g = gcd(ux, uy);
  const A = uy / g;
  const B = ux / g;
  const R = (ux * uy) / g;
  const D = -2 * A * h;
  const E = -2 * B * k;
  const F = A * h * h + B * k * k - R;
  const eq = md`${poly([[A, "x^2"], [B, "y^2"], [D, "x"], [E, "y"], [F, ""]])} = 0`;
  const c2 = a * a - b * b;
  const verify = PARAM_T.map((t) => {
    const X = horizontal ? `(a + c cos(${t}))` : `(a + d cos(${t}))`;
    const Y = horizontal ? `(b + d sin(${t}))` : `(b + c sin(${t}))`;
    return `${poly([[A, `${X}^2`], [B, `${Y}^2`], [D, X], [E, Y], [F, ""]])} = 0`;
  });
  return {
    prompt: md`Write $${eq}$ in standard form and give $(h, k, a, b)$ as a tuple, like (2, -1, 5, 3), where $(h, k)$ is the center, $a$ the semi-major axis and $b$ the semi-minor axis.`,
    answer: `(${h}, ${k}, ${a}, ${b})`,
    form: "tuple",
    verify,
    hint: md`Group the $x$-terms and the $y$-terms, factor out ${A} and ${B}, and complete both squares. Whatever you add inside the parentheses gets multiplied by the factor in front before it goes to the right side.`,
    solution: [
      { math: md`${A}(x^2 ${signed(-2 * h)}x) + ${B}(y^2 ${signed(-2 * k)}y) = ${-F}`, note: "Group by variable and factor out the leading coefficients. The constant goes right." },
      {
        math: md`${A}(x^2 ${signed(-2 * h)}x + ${h * h}) + ${B}(y^2 ${signed(-2 * k)}y + ${k * k}) = ${-F} + ${A * h * h} + ${B * k * k}`,
        note: md`Half of $${-2 * h}$ is $${-h}$, squared $${h * h}$; half of $${-2 * k}$ is $${-k}$, squared $${k * k}$. Adding $${h * h}$ inside the first parentheses adds $${A} \cdot ${h * h} = ${A * h * h}$ to the left side, so add that to the right. Likewise $${B} \cdot ${k * k} = ${B * k * k}$.`,
      },
      { math: md`${A}${sh("x", h)}^2 + ${B}${sh("y", k)}^2 = ${R}`, note: "Both groups are perfect squares." },
      { math: stdEllipse(h, k, ux, uy), note: md`Divide by ${R}.` },
      {
        math: md`(h, k, a, b) = (${h}, ${k}, ${a}, ${b})`,
        note: md`Center $${pt(h, k)}$. The larger denominator, $${a * a}$, is under $${horizontal ? "x" : "y"}$: the major axis is ${horizontal ? "horizontal" : "vertical"}, $a = ${a}$, $b = ${b}$, and $c = \sqrt{${c2}} = ${root(c2).tex}$.`,
      },
    ],
  };
};

const ellipseFromData: Generator = (r) => {
  const kind = r.int(0, 2);
  const { a, b } = r.pick(kind === 1 ? ELLIPSES : INTEGER_ELLIPSES);
  const c = Math.round(Math.sqrt(a * a - b * b));
  const horizontal = r.next() < 0.5;
  const h = r.int(-4, 4);
  const k = r.int(-4, 4);
  const along = (d: number) => (horizontal ? [h + d, k] : [h, k + d]);
  const across = (d: number) => (horizontal ? [h, k + d] : [h + d, k]);
  const [V1, V2] = [along(a), along(-a)];
  const [F1, F2] = [along(c), along(-c)];
  const [W1, W2] = [across(b), across(-b)];
  const P = (p: number[]) => pt(p[0]!, p[1]!);
  const [ux, uy] = horizontal ? [a * a, b * b] : [b * b, a * a];
  const answer = `(${h}, ${k}, ${a}, ${b})`;
  const onCurve = (p: number[]) => (horizontal ? `(${p[0]} - a)^2/c^2 + (${p[1]} - b)^2/d^2 = 1` : `(${p[0]} - a)^2/d^2 + (${p[1]} - b)^2/c^2 = 1`);
  const sumAt = (t: string, total: string) => {
    const X = horizontal ? `(a + c cos(${t}))` : `(a + d cos(${t}))`;
    const Y = horizontal ? `(b + d sin(${t}))` : `(b + c sin(${t}))`;
    return `sqrt((${X} - ${paren(F1[0]!)})^2 + (${Y} - ${paren(F1[1]!)})^2) + sqrt((${X} - ${paren(F2[0]!)})^2 + (${Y} - ${paren(F2[1]!)})^2) = ${total}`;
  };
  const centerStep = (p1: number[], p2: number[], what: string): Step => ({
    math: md`\text{center} = \left(\frac{${p1[0]} + ${paren(p2[0]!)}}{2}, \frac{${p1[1]} + ${paren(p2[1]!)}}{2}\right) = ${pt(h, k)}`,
    note: md`The center is the midpoint of the ${what}. They lie on a ${horizontal ? "horizontal" : "vertical"} line, so the major axis is ${horizontal ? "horizontal" : "vertical"}.`,
  });
  const last: Step[] = [
    { math: stdEllipse(h, k, ux, uy), note: md`$a^2 = ${a * a}$ goes under $${horizontal ? "x" : "y"}$, the major-axis variable.` },
    { math: md`(h, k, a, b) = (${h}, ${k}, ${a}, ${b})`, note: "" },
  ];
  const format = md`Give $(h, k, a, b)$ as a tuple, like (2, -1, 5, 3), where $(h, k)$ is the center, $a$ the semi-major axis and $b$ the semi-minor axis.`;
  if (kind === 0) {
    return {
      prompt: md`An ellipse has foci $${P(F1)}$ and $${P(F2)}$ and vertices $${P(V1)}$ and $${P(V2)}$. Write its standard equation. ${format}`,
      answer,
      form: "tuple",
      verify: [onCurve(V1), onCurve(V2), sumAt("pi/6", "2c")],
      hint: md`The center is the midpoint of the foci. $a$ is the distance from the center to a vertex, $c$ the distance to a focus, and $b^2 = a^2 - c^2$.`,
      solution: [
        centerStep(F1, F2, "foci"),
        { math: md`a = ${a}, \quad c = ${c}`, note: md`From the center to the vertex $${P(V1)}$ is ${a}; to the focus $${P(F1)}$ is ${c}.` },
        { math: md`b^2 = a^2 - c^2 = ${a * a} - ${c * c} = ${b * b}, \quad b = ${b}`, note: "The right triangle with hypotenuse a." },
        ...last,
      ],
    };
  }
  if (kind === 1) {
    return {
      prompt: md`An ellipse has vertices $${P(V1)}$ and $${P(V2)}$ and co-vertices $${P(W1)}$ and $${P(W2)}$. Write its standard equation. ${format}`,
      answer,
      form: "tuple",
      verify: [onCurve(V1), onCurve(V2), onCurve(W1), onCurve(W2)],
      hint: md`The vertices are the ends of the major axis (length $2a$); the co-vertices are the ends of the minor axis (length $2b$). The center is the midpoint of either pair.`,
      solution: [
        centerStep(V1, V2, "vertices"),
        { math: md`a = ${a}, \quad b = ${b}`, note: md`Center to a vertex is ${a}; center to a co-vertex is ${b}. The longer one is $a$.` },
        ...last,
      ],
    };
  }
  return {
    prompt: md`An ellipse has foci $${P(F1)}$ and $${P(F2)}$, and its major axis has length ${2 * a}. Write its standard equation. ${format}`,
    answer,
    form: "tuple",
    verify: [sumAt("0", String(2 * a)), sumAt("pi/2", String(2 * a)), sumAt("pi/6", String(2 * a)), sumAt("4pi/3", String(2 * a))],
    hint: md`The major axis has length $2a$. The center is the midpoint of the foci, $c$ is the center-to-focus distance, and $b^2 = a^2 - c^2$.`,
    solution: [
      centerStep(F1, F2, "foci"),
      { math: md`2a = ${2 * a} \;\Rightarrow\; a = ${a}, \qquad c = ${c}`, note: md`The sum of distances from any point of the ellipse to the foci is $2a$, the length of the major axis. From the center to $${P(F1)}$ is ${c}.` },
      { math: md`b^2 = ${a * a} - ${c * c} = ${b * b}, \quad b = ${b}`, note: "" },
      ...last,
    ],
  };
};

const ellipseLocus: DiagramSpec = (() => {
  const n = 48;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const th = (2 * Math.PI * i) / n;
    return [r3(4 * Math.cos(th)), `${r3(Math.sin(th))}*sqrt(16 - c^2)`] as [number | string, number | string];
  });
  const curve = polyline("E", pts, 1);
  const d1 = "sqrt((4cos(t pi/180) + c)^2 + (16 - c^2)(sin(t pi/180))^2)";
  const d2 = "sqrt((4cos(t pi/180) - c)^2 + (16 - c^2)(sin(t pi/180))^2)";
  return {
    view: [-6, 6, -5, 5],
    grid: true,
    params: [
      { name: "c", tex: md`c \text{ (center to focus)}`, min: 0, max: 3.5, step: 0.5, value: 3 },
      { name: "t", tex: md`\text{position of } P`, min: 0, max: 360, step: 5, value: 50 },
    ],
    points: [
      ...curve.points,
      { name: "F1", x: "-c", y: 0, label: md`F_1`, dir: "s" },
      { name: "F2", x: "c", y: 0, label: md`F_2`, dir: "s" },
      { name: "P", x: "4cos(t pi/180)", y: "sqrt(16 - c^2) sin(t pi/180)", dir: "ne" },
    ],
    segments: [...curve.segments, { from: "P", to: "F1", color: 3 }, { from: "P", to: "F2", color: 2 }],
    readouts: [
      { label: md`PF_1`, value: d1 },
      { label: md`PF_2`, value: d2 },
      { label: md`PF_1 + PF_2`, value: `${d1} + ${d2}` },
    ],
    caption: md`Here $a = 4$. Slide $P$ around: the two distances trade off, but their sum stays $8 = 2a$. Slide $c$ toward 0: the foci merge at the center and the ellipse becomes a circle of radius 4. Slide $c$ toward 4: the ellipse flattens toward the segment between the foci.`,
  };
})();

const ellipsesLesson: Lesson = {
  id: slug("Ellipses"),
  title: "Ellipses",
  summary: "The two-focus definition, the equation it forces, why a, b, c form a right triangle, and how to read any ellipse.",
  blocks: [
    {
      kind: "text" as const,
      body: md`Push two pins into a board, tie a loose loop of string around them, pull it taut with a pencil and draw. The pencil traces an ellipse. The string's length never changes, so the pencil's distance to one pin plus its distance to the other is constant. That is the whole definition.`,
    },
    {
      kind: "key" as const,
      title: "Ellipse",
      body: md`Fix two points $F_1$ and $F_2$ (the **foci**) and a number $2a$ larger than the distance $F_1F_2 = 2c$. The ellipse is the set of points $P$ with

$$PF_1 + PF_2 = 2a.$$

The **center** is the midpoint of the foci. The **major axis** is the chord through the foci; its ends are the **vertices**, and it has length $2a$. The **minor axis** is the perpendicular chord through the center; its ends are the **co-vertices**, and it has length $2b$, where $b^2 = a^2 - c^2$.`,
    },
    { kind: "diagram" as const, ...ellipseLocus },
    {
      kind: "why" as const,
      title: "Why the constant is called 2a, and why 2a must beat 2c",
      body: md`Put $P$ at a vertex, the point of the ellipse on the line through the foci, beyond $F_2$. Its distance to $F_2$ is some $d$, and its distance to $F_1$ is $d + 2c$. The sum is $2d + 2c = 2a$, so $d = a - c$, and the vertex is $a - c + c = a$ from the center. The constant in the definition is exactly the length of the major axis, which is why it is named $2a$.

The triangle inequality (Geometry) says $PF_1 + PF_2 \ge F_1F_2 = 2c$ for every point $P$, with equality only on the segment between the foci. So if $2a = 2c$ the "ellipse" is just that segment, and if $2a < 2c$ there are no points at all. A real ellipse needs $a > c$.`,
    },
    {
      kind: "text" as const,
      body: md`Now the equation. Center at the origin, foci at $(-c, 0)$ and $(c, 0)$, and let $P = (x, y)$ satisfy the rule. Two square roots have to be cleared, so we square twice, isolating a root before each squaring.`,
    },
    {
      kind: "proof" as const,
      title: "The equation of an ellipse",
      given: md`Foci $F_1(-c, 0)$ and $F_2(c, 0)$, a number $a > c > 0$, and a point $P(x, y)$ with $PF_1 + PF_2 = 2a$`,
      prove: md`$\dfrac{x^2}{a^2} + \dfrac{y^2}{b^2} = 1$, where $b^2 = a^2 - c^2$`,
      steps: [
        { statement: md`$\sqrt{(x + c)^2 + y^2} + \sqrt{(x - c)^2 + y^2} = 2a$`, reason: "Distance formula and the definition." },
        { statement: md`$\sqrt{(x + c)^2 + y^2} = 2a - \sqrt{(x - c)^2 + y^2}$`, reason: "Isolate one root." },
        { statement: md`$(x + c)^2 + y^2 = 4a^2 - 4a\sqrt{(x - c)^2 + y^2} + (x - c)^2 + y^2$`, reason: md`Square both sides. The right side is $PF_1 \ge 0$, so nothing is lost.` },
        { statement: md`$4cx = 4a^2 - 4a\sqrt{(x - c)^2 + y^2}$`, reason: md`$(x + c)^2 - (x - c)^2 = 4cx$; the $y^2$ terms cancel.` },
        { statement: md`$a\sqrt{(x - c)^2 + y^2} = a^2 - cx$`, reason: "Divide by 4 and rearrange." },
        { statement: md`$a^2(x^2 - 2cx + c^2 + y^2) = a^4 - 2a^2cx + c^2x^2$`, reason: md`Square again. $a^2 - cx > 0$ because $|x| \le a$ and $c < a$, so again nothing is lost.` },
        { statement: md`$(a^2 - c^2)x^2 + a^2y^2 = a^2(a^2 - c^2)$`, reason: md`The $-2a^2cx$ terms cancel; collect $x^2$ terms on the left and constants on the right.` },
        { statement: md`$b^2x^2 + a^2y^2 = a^2b^2$`, reason: md`Name $a^2 - c^2 = b^2$. It is positive since $a > c$.` },
        { statement: md`$\dfrac{x^2}{a^2} + \dfrac{y^2}{b^2} = 1$`, reason: md`Divide by $a^2b^2$.` },
      ],
    },
    {
      kind: "why" as const,
      title: "Why b² = a² − c², and what b is",
      body: md`At the end of the proof the number $a^2 - c^2$ appeared and we named it $b^2$. It has a meaning. Put $x = 0$ in the equation: $y = \pm b$, so the ellipse crosses the minor axis at $(0, \pm b)$. At that point the two focal distances are equal, so each is $a$ (their sum is $2a$). Each one is the hypotenuse of a right triangle with legs $b$ (up the minor axis) and $c$ (out to a focus). Pythagoras: $b^2 + c^2 = a^2$.

So $a$, $b$, $c$ always form a right triangle, and $a$, the longest, is the hypotenuse. That is the one fact to remember; the formula follows from it.`,
    },
    {
      kind: "key" as const,
      title: "Standard forms",
      body: md`With center $(h, k)$ and $a > b > 0$:

- **Horizontal major axis:** $\dfrac{(x - h)^2}{a^2} + \dfrac{(y - k)^2}{b^2} = 1$. Vertices $(h \pm a, k)$, co-vertices $(h, k \pm b)$, foci $(h \pm c, k)$.
- **Vertical major axis:** $\dfrac{(x - h)^2}{b^2} + \dfrac{(y - k)^2}{a^2} = 1$. Vertices $(h, k \pm a)$, co-vertices $(h \pm b, k)$, foci $(h, k \pm c)$.

In both, $c^2 = a^2 - b^2$. The larger denominator is $a^2$, and the variable it sits under tells you the direction of the major axis. The **eccentricity** $e = \dfrac{c}{a}$ measures how far from circular the ellipse is: $0 \le e < 1$, with $e = 0$ a circle.`,
    },
    {
      kind: "plot" as const,
      x: [-7, 7],
      y: [-5, 5],
      parametric: [{ x: "a cos(t)", y: "b sin(t)", t: [0, 6.2832], label: "\\frac{x^2}{a^2} + \\frac{y^2}{b^2} = 1" }],
      points: [
        { x: "sqrt(a^2 - b^2)", y: 0, label: "F_2", color: 2 },
        { x: "-sqrt(a^2 - b^2)", y: 0, label: "F_1", color: 2 },
        { x: "a", y: 0, label: "(a, 0)", color: 3 },
        { x: 0, y: "b", label: "(0, b)", color: 3 },
      ],
      params: [
        { name: "a", min: 3, max: 5, step: 0.5, value: 4 },
        { name: "b", min: 1, max: 2.5, step: 0.5, value: 2.5 },
      ],
      caption: md`$c = \sqrt{a^2 - b^2} = {=sqrt(a^2 - b^2)}$ and $e = c/a = {=sqrt(a^2 - b^2)/a}$. Shrink $b$ with $a$ fixed: the foci slide outward toward the vertices and $e$ climbs toward 1. Grow $b$ toward $a$: the foci close in on the center and the shape rounds out.`,
    },
    {
      kind: "why" as const,
      title: "Why (a cos t, b sin t) traces the ellipse",
      body: md`Substitute $x = a\cos t$ and $y = b\sin t$ into the equation: $\dfrac{a^2\cos^2 t}{a^2} + \dfrac{b^2\sin^2 t}{b^2} = \cos^2 t + \sin^2 t = 1$. Every such point is on the ellipse, and as $t$ runs from 0 to $2\pi$ the point goes once around.

Read it as a recipe: start with the unit circle $(\cos t, \sin t)$, stretch it by $a$ horizontally and $b$ vertically. An ellipse is a stretched circle, which is why its area is $\pi ab$ and why a tilted circle (a coin seen at an angle) looks like one. Unit 6 uses this parametric form for everything.`,
    },
    {
      kind: "example" as const,
      title: "Reading an equation",
      problem: md`Find the vertices, co-vertices, foci and eccentricity of $9x^2 + 25y^2 = 225$.`,
      steps: [
        { math: md`\frac{x^2}{25} + \frac{y^2}{9} = 1`, note: "Divide by 225 to get 1 on the right." },
        { math: md`a = 5, \quad b = 3`, note: md`$25 > 9$, and 25 is under $x$: the major axis is horizontal.` },
        { math: md`c = \sqrt{25 - 9} = 4`, note: md`$c^2 = a^2 - b^2$.` },
        { math: md`(\pm 5, 0), \quad (0, \pm 3), \quad (\pm 4, 0), \quad e = \tfrac{4}{5}`, note: "Vertices, co-vertices, foci, eccentricity." },
      ],
    },
    {
      kind: "example" as const,
      title: "Completing two squares",
      problem: md`Find the center and foci of $4x^2 + 9y^2 - 16x + 18y - 11 = 0$.`,
      steps: [
        { math: md`4(x^2 - 4x) + 9(y^2 + 2y) = 11`, note: "Group by variable, factor out the leading coefficients, move the constant right." },
        { math: md`4(x^2 - 4x + 4) + 9(y^2 + 2y + 1) = 11 + 16 + 9`, note: md`Adding 4 inside the first parentheses really adds $4 \cdot 4 = 16$; adding 1 inside the second adds $9 \cdot 1 = 9$. Add the same to the right.` },
        { math: md`4(x - 2)^2 + 9(y + 1)^2 = 36`, note: "" },
        { math: md`\frac{(x - 2)^2}{9} + \frac{(y + 1)^2}{4} = 1`, note: "Divide by 36." },
        { math: md`\text{center } (2, -1), \quad a = 3, \quad b = 2, \quad c = \sqrt{5}`, note: md`Horizontal major axis. Foci $(2 \pm \sqrt{5}, -1)$.` },
      ],
    },
    {
      kind: "example" as const,
      title: "From foci and vertices",
      problem: md`Write the equation of the ellipse with foci $(1, 3)$ and $(1, -3)$ and vertices $(1, 5)$ and $(1, -5)$.`,
      steps: [
        { math: md`\text{center } (1, 0)`, note: "Midpoint of the foci. They line up vertically, so the major axis is vertical." },
        { math: md`a = 5, \quad c = 3`, note: "Center to vertex, center to focus." },
        { math: md`b^2 = 25 - 9 = 16`, note: "" },
        { math: md`\frac{(x - 1)^2}{16} + \frac{y^2}{25} = 1`, note: md`$a^2 = 25$ goes under $y$, the major-axis variable.` },
      ],
    },
    {
      kind: "text" as const,
      body: md`Kepler discovered that planets move on ellipses with the sun at one focus, not at the center. Earth's orbit has $e \approx 0.017$, so close to a circle that the difference is invisible in a drawing; Halley's comet has $e \approx 0.97$. And an ellipse reflects: a sound made at one focus bounces off the wall and arrives at the other focus, which is the trick behind whispering galleries.`,
    },
    {
      kind: "check" as const,
      prompt: md`Find $c$, the distance from the center to each focus, for $\dfrac{x^2}{16} + \dfrac{y^2}{7} = 1$.`,
      answer: "3",
      explain: md`$a^2 = 16$ and $b^2 = 7$, so $c^2 = 16 - 7 = 9$ and $c = 3$. The foci are $(\pm 3, 0)$.`,
    },
    {
      kind: "check" as const,
      prompt: md`Is the major axis of $\dfrac{(x - 1)^2}{4} + \dfrac{(y + 2)^2}{9} = 1$ horizontal or vertical?`,
      choices: ["horizontal", "vertical"],
      accept: ["vertical"],
      explain: md`The larger denominator, 9, is under $y$, so $a = 3$ runs vertically. Center $(1, -2)$, vertices $(1, 1)$ and $(1, -5)$.`,
    },
  ],
  practice: [ellipseFeatures, ellipseGeneralForm, ellipseFromData],
};

// ── Lesson 3: Hyperbolas ────────────────────────────────────────────────────

const hyperbolaFeatures: Generator = (r) => {
  const { a, b } = r.pick(HYPERBOLAS);
  const c2 = a * a + b * b;
  const c = root(c2);
  const horizontal = r.next() < 0.5;
  const centered = r.next() < 0.3;
  const h = centered ? 0 : r.int(-4, 4);
  const k = centered ? 0 : r.int(-4, 4);
  const a2 = a * a;
  const b2 = b * b;
  const g = gcd(a2, b2);
  const multiplied = centered && r.next() < 0.5;
  const eq = multiplied
    ? horizontal
      ? md`${poly([[b2 / g, "x^2"], [-a2 / g, "y^2"]])} = ${(a2 * b2) / g}`
      : md`${poly([[b2 / g, "y^2"], [-a2 / g, "x^2"]])} = ${(a2 * b2) / g}`
    : stdHyperbola(h, k, horizontal, a2, b2);
  const steps: Step[] = [];
  if (multiplied) steps.push({ math: stdHyperbola(0, 0, horizontal, a2, b2), note: md`Divide by ${(a2 * b2) / g} so the right side is 1.` });
  steps.push({
    math: md`a^2 = ${a2}, \quad b^2 = ${b2}, \quad a = ${a}, \quad b = ${b}`,
    note: md`$a^2$ is the denominator of the **positive** term, under $${horizontal ? "x" : "y"}$: the transverse axis is ${horizontal ? "horizontal" : "vertical"} and the branches open ${horizontal ? "left and right" : "up and down"}. The center is $${pt(h, k)}$.`,
  });
  const kind = r.int(0, 2);
  const curve = horizontal ? `((x - ${paren(h)})^2)/${a2} - ((y - ${paren(k)})^2)/${b2} = 1` : `((y - ${paren(k)})^2)/${a2} - ((x - ${paren(h)})^2)/${b2} = 1`;
  if (kind === 0) {
    const V = horizontal ? [h + a, k] : [h, k + a];
    return {
      prompt: md`Find the vertex of the hyperbola $${eq}$ with the larger $${horizontal ? "x" : "y"}$-coordinate. Give it as a point, like (2, -3).`,
      answer: pt(V[0]!, V[1]!),
      form: "tuple",
      verify: [curve, `(x - ${paren(h)})^2 + (y - ${paren(k)})^2 = ${a2}`],
      hint: md`The vertices are $a$ from the center along the transverse axis, the direction of the positive term.`,
      solution: [...steps, { math: horizontal ? md`V = (h + a, k) = ${pt(V[0]!, V[1]!)}` : md`V = (h, k + a) = ${pt(V[0]!, V[1]!)}`, note: md`Move $a = ${a}$ from the center along the transverse axis.` }],
    };
  }
  if (kind === 1) {
    const F = horizontal ? [offset(h, c2, 1).text, String(k)] : [String(h), offset(k, c2, 1).text];
    const FT = horizontal ? [offset(h, c2, 1).tex, String(k)] : [String(h), offset(k, c2, 1).tex];
    const [Vn, Vp] = horizontal ? [[h - a, k], [h + a, k]] : [[h, k - a], [h, k + a]];
    return {
      prompt: md`Find the focus of the hyperbola $${eq}$ with the larger $${horizontal ? "x" : "y"}$-coordinate. Give it as a point, like (2, -3)${c.exact ? "" : " or (1 + sqrt(5), 2)"}.`,
      answer: pt(F[0]!, F[1]!),
      form: "tuple",
      verify: [
        `(x - ${paren(h)})^2 + (y - ${paren(k)})^2 = ${c2}`,
        `sqrt((x - ${paren(Vn[0]!)})^2 + (y - ${paren(Vn[1]!)})^2) - sqrt((x - ${paren(Vp[0]!)})^2 + (y - ${paren(Vp[1]!)})^2) = ${2 * a}`,
      ],
      hint: md`For a hyperbola $c^2 = a^2 + b^2$: $c$ is the hypotenuse now. The foci are $c$ from the center along the transverse axis.`,
      solution: [
        ...steps,
        { math: md`c^2 = a^2 + b^2 = ${a2} + ${b2} = ${c2}, \quad c = ${c.tex}`, note: "Plus, not minus: the foci are outside the vertices." },
        { math: horizontal ? md`F = (h + c, k) = ${pt(FT[0]!, FT[1]!)}` : md`F = (h, k + c) = ${pt(FT[0]!, FT[1]!)}`, note: "" },
      ],
    };
  }
  const [num, den] = horizontal ? [b, a] : [a, b];
  const corner = horizontal ? [h + a, k + b] : [h + b, k + a];
  return {
    prompt: md`Find the slope of the asymptote of $${eq}$ that has positive slope. Fractions are fine, like 3/4.`,
    answer: frac(num, den),
    verify: [`${paren(corner[1]!)} = ${paren(k)} + m*(${paren(corner[0]!)} - ${paren(h)})`],
    hint: md`The asymptotes are the diagonals of the box with corners $(h \pm a, k \pm b)$. Rise over run from the center to a corner: ${horizontal ? "$b/a$ for a horizontal transverse axis" : "$a/b$ for a vertical transverse axis"}.`,
    solution: [
      ...steps,
      {
        math: md`\text{slope} = \frac{${horizontal ? "b" : "a"}}{${horizontal ? "a" : "b"}} = ${fracTex(num, den)}`,
        note: md`From the center $${pt(h, k)}$ to the box corner $${pt(corner[0]!, corner[1]!)}$: up $${horizontal ? b : a}$, across $${horizontal ? a : b}$. The asymptotes are $y ${signed(-k)} = \pm ${fracTex(num, den)}${sh("x", h)}$.`,
      },
    ],
  };
};

const PARAM_U = [0.5, -0.8, 1.2, -0.3];

const hyperbolaGeneralForm: Generator = (r) => {
  const { a, b } = r.pick(SMALL_HYPERBOLAS);
  const horizontal = r.next() < 0.5;
  const h = r.nonzero(-4, 4);
  const k = r.nonzero(-4, 4);
  const a2 = a * a;
  const b2 = b * b;
  const g = gcd(a2, b2);
  // horizontal: b^2 (x-h)^2 - a^2 (y-k)^2 = a^2 b^2;  vertical: b^2 (y-k)^2 - a^2 (x-h)^2 = a^2 b^2.
  const A = horizontal ? b2 / g : -a2 / g;
  const C = horizontal ? -a2 / g : b2 / g;
  const R = (a2 * b2) / g;
  const D = -2 * A * h;
  const E = -2 * C * k;
  const F = A * h * h + C * k * k - R;
  const eq = horizontal ? md`${poly([[A, "x^2"], [C, "y^2"], [D, "x"], [E, "y"], [F, ""]])} = 0` : md`${poly([[C, "y^2"], [A, "x^2"], [E, "y"], [D, "x"], [F, ""]])} = 0`;
  const verify = PARAM_U.map((u) => {
    const X = horizontal ? `(a + c cosh(${u}))` : `(a + d sinh(${u}))`;
    const Y = horizontal ? `(b + d sinh(${u}))` : `(b + c cosh(${u}))`;
    return `${poly([[A, `${X}^2`], [C, `${Y}^2`], [D, X], [E, Y], [F, ""]])} = 0`;
  });
  const [P, N] = horizontal ? [A, C] : [C, A]; // positive-term coefficient, negative-term coefficient
  const [pv, nv] = horizontal ? ["x", "y"] : ["y", "x"];
  const [ps, ns] = horizontal ? [h, k] : [k, h];
  return {
    prompt: md`Write $${eq}$ in standard form and give $(h, k, a, b)$ as a tuple, like (2, -1, 3, 4), where $(h, k)$ is the center, $a$ the distance from the center to a vertex, and $b$ the number under the negative term's square root.`,
    answer: `(${h}, ${k}, ${a}, ${b})`,
    form: "tuple",
    verify,
    hint: md`Group the $x$-terms and the $y$-terms and factor out the leading coefficients, sign included: the group with the negative coefficient is subtracted. Then complete both squares.`,
    solution: [
      {
        math: md`${P}(${pv}^2 ${signed(-2 * ps)}${pv}) - ${-N}(${nv}^2 ${signed(-2 * ns)}${nv}) = ${-F}`,
        note: md`Factor $${P}$ out of the $${pv}$-terms and $${-N}$ out of the $${nv}$-terms, so the second group is subtracted.`,
      },
      {
        math: md`${P}(${pv}^2 ${signed(-2 * ps)}${pv} + ${ps * ps}) - ${-N}(${nv}^2 ${signed(-2 * ns)}${nv} + ${ns * ns}) = ${-F} + ${P * ps * ps} - ${-N * ns * ns}`,
        note: md`Half of $${-2 * ps}$ squared is $${ps * ps}$, which adds $${P} \cdot ${ps * ps} = ${P * ps * ps}$ to the left. Half of $${-2 * ns}$ squared is $${ns * ns}$, which, because of the minus in front, **subtracts** $${-N} \cdot ${ns * ns} = ${-N * ns * ns}$. Do the same to the right.`,
      },
      { math: md`${P}${sh(pv, ps)}^2 - ${-N}${sh(nv, ns)}^2 = ${R}`, note: "Both groups are perfect squares." },
      { math: stdHyperbola(h, k, horizontal, a2, b2), note: md`Divide by ${R}. The positive term is in $${pv}$, so the transverse axis is ${horizontal ? "horizontal" : "vertical"}.` },
      { math: md`(h, k, a, b) = (${h}, ${k}, ${a}, ${b})`, note: md`$a^2 = ${a2}$ under the positive term, $b^2 = ${b2}$ under the negative one, and $c = \sqrt{${a2 + b2}} = ${root(a2 + b2).tex}$.` },
    ],
  };
};

const hyperbolaFromData: Generator = (r) => {
  const kind = r.int(0, 2);
  const { a, b } = r.pick(kind === 1 ? HYPERBOLAS : INTEGER_HYPERBOLAS);
  const c = Math.round(Math.sqrt(a * a + b * b));
  const horizontal = r.next() < 0.5;
  // For asymptote data, keep the intercepts tidy: the center's x is a multiple of the slope's denominator.
  const den = horizontal ? a : b;
  const num = horizontal ? b : a;
  const gm = gcd(num, den);
  const [mn, md_] = [num / gm, den / gm];
  const h = kind === 0 ? r.int(-4, 4) : md_ * r.int(-2, 2);
  const k = r.int(-4, 4);
  const along = (d: number) => (horizontal ? [h + d, k] : [h, k + d]);
  const [V1, V2] = [along(a), along(-a)];
  const [F1, F2] = [along(c), along(-c)];
  const P = (p: number[]) => pt(p[0]!, p[1]!);
  const answer = `(${h}, ${k}, ${a}, ${b})`;
  const onCurve = (p: number[]) => (horizontal ? `(${p[0]} - a)^2/c^2 - (${p[1]} - b)^2/d^2 = 1` : `(${p[1]} - b)^2/c^2 - (${p[0]} - a)^2/d^2 = 1`);
  const diffAt = (u: number) => {
    const X = horizontal ? `(a + c cosh(${u}))` : `(a + d sinh(${u}))`;
    const Y = horizontal ? `(b + d sinh(${u}))` : `(b + c cosh(${u}))`;
    return `abs(sqrt((${X} - ${paren(F1[0]!)})^2 + (${Y} - ${paren(F1[1]!)})^2) - sqrt((${X} - ${paren(F2[0]!)})^2 + (${Y} - ${paren(F2[1]!)})^2)) = 2c`;
  };
  // Asymptotes y = m x + n1 and y = -m x + n2 through the center, slope m = num/den.
  const m = `${mn}/${md_}`;
  const n1 = frac(k * md_ - mn * h, md_);
  const n2 = frac(k * md_ + mn * h, md_);
  const lineTex = (sign: 1 | -1, n: string) => {
    const slope = md_ === 1 ? (mn === 1 ? "" : String(mn)) : fracTex(mn, md_);
    const [nn, nd] = (n.includes("/") ? n.split("/").map(Number) : [Number(n), 1]) as [number, number];
    const nTex = nn === 0 ? "" : ` ${nn < 0 ? "-" : "+"} ${nd === 1 ? Math.abs(nn) : `\\frac{${Math.abs(nn)}}{${nd}}`}`;
    return `y = ${sign < 0 ? "-" : ""}${slope}x${nTex}`;
  };
  const asym1 = lineTex(1, n1);
  const asym2 = lineTex(-1, n2);
  const cornerOnLines = horizontal
    ? [`b + d = (${m})*(a + c) + (${n1})`, `b - d = -(${m})*(a + c) + (${n2})`]
    : [`b + c = (${m})*(a + d) + (${n1})`, `b - c = -(${m})*(a + d) + (${n2})`];
  const [ux, uy] = [a * a, b * b];
  const last: Step[] = [
    { math: stdHyperbola(h, k, horizontal, ux, uy), note: md`$a^2 = ${ux}$ under the positive term, $${horizontal ? "x" : "y"}$.` },
    { math: md`(h, k, a, b) = (${h}, ${k}, ${a}, ${b})`, note: "" },
  ];
  const format = md`Give $(h, k, a, b)$ as a tuple, like (2, -1, 3, 4), where $(h, k)$ is the center, $a$ the center-to-vertex distance and $b$ the number under the negative term's square root.`;
  if (kind === 0) {
    return {
      prompt: md`A hyperbola has vertices $${P(V1)}$ and $${P(V2)}$ and foci $${P(F1)}$ and $${P(F2)}$. Write its standard equation. ${format}`,
      answer,
      form: "tuple",
      verify: [onCurve(V1), onCurve(V2), diffAt(0.7)],
      hint: md`The center is the midpoint of the vertices, $a$ is the center-to-vertex distance, $c$ the center-to-focus distance, and $b^2 = c^2 - a^2$.`,
      solution: [
        { math: md`\text{center} = \left(\frac{${V1[0]} + ${paren(V2[0]!)}}{2}, \frac{${V1[1]} + ${paren(V2[1]!)}}{2}\right) = ${pt(h, k)}`, note: md`Midpoint of the vertices. They line up ${horizontal ? "horizontally" : "vertically"}, so the transverse axis is ${horizontal ? "horizontal" : "vertical"}.` },
        { math: md`a = ${a}, \quad c = ${c}`, note: md`Center to vertex, center to focus.` },
        { math: md`b^2 = c^2 - a^2 = ${c * c} - ${a * a} = ${b * b}, \quad b = ${b}`, note: md`$c$ is the hypotenuse for a hyperbola.` },
        ...last,
      ],
    };
  }
  if (kind === 1) {
    return {
      prompt: md`A hyperbola has vertices $${P(V1)}$ and $${P(V2)}$ and asymptotes $${asym1}$ and $${asym2}$. Write its standard equation. ${format}`,
      answer,
      form: "tuple",
      verify: [onCurve(V1), onCurve(V2), ...cornerOnLines],
      hint: md`The center is the midpoint of the vertices. The asymptotes' slopes are $\pm\frac{b}{a}$ for a horizontal transverse axis and $\pm\frac{a}{b}$ for a vertical one; you know $a$, so solve for $b$.`,
      solution: [
        { math: md`\text{center} = ${pt(h, k)}, \quad a = ${a}`, note: md`Midpoint of the vertices, and the distance from it to a vertex. The transverse axis is ${horizontal ? "horizontal" : "vertical"}. (Check: both asymptotes pass through $${pt(h, k)}$.)` },
        {
          math: horizontal ? md`\frac{b}{a} = ${fracTex(num, den)} \;\Rightarrow\; b = ${fracTex(num, den)} \cdot ${a} = ${b}` : md`\frac{a}{b} = ${fracTex(num, den)} \;\Rightarrow\; b = \frac{${a}}{${fracTex(num, den)}} = ${b}`,
          note: md`The asymptote slopes are the diagonals of the box with half-width and half-height $a$ and $b$ (${horizontal ? "rise $b$ over run $a$" : "rise $a$ over run $b$"}).`,
        },
        ...last,
      ],
    };
  }
  return {
    prompt: md`A hyperbola has foci $${P(F1)}$ and $${P(F2)}$ and asymptotes $${asym1}$ and $${asym2}$. Write its standard equation. ${format}`,
    answer,
    form: "tuple",
    verify: [...cornerOnLines, diffAt(0.7), diffAt(-1.1)],
    hint: md`The center is the midpoint of the foci, so you know $c$. The slope gives the ratio of $b$ to $a$, and $a^2 + b^2 = c^2$ pins both down.`,
    solution: [
      { math: md`\text{center} = ${pt(h, k)}, \quad c = ${c}`, note: md`Midpoint of the foci and the distance to one of them. The foci line up ${horizontal ? "horizontally" : "vertically"}, so the transverse axis is ${horizontal ? "horizontal" : "vertical"}.` },
      {
        math: horizontal ? md`\frac{b}{a} = ${fracTex(num, den)}, \quad a^2 + b^2 = ${c * c}` : md`\frac{a}{b} = ${fracTex(num, den)}, \quad a^2 + b^2 = ${c * c}`,
        note: md`Two equations in $a$ and $b$. Write ${horizontal ? `$b = ${fracTex(num, den)}a$` : `$a = ${fracTex(num, den)}b$`} and substitute: ${horizontal ? `$a^2\\left(1 + ${fracTex(num * num, den * den)}\\right) = ${c * c}$` : `$b^2\\left(${fracTex(num * num, den * den)} + 1\\right) = ${c * c}$`}.`,
      },
      { math: md`a = ${a}, \quad b = ${b}`, note: md`Check: $${a}^2 + ${b}^2 = ${c * c}$.` },
      ...last,
    ],
  };
};

const hyperbolaLocus: DiagramSpec = (() => {
  const us = Array.from({ length: 37 }, (_, i) => r3(-1.8 + i * 0.1));
  const right = polyline("R", us.map((u) => [r3(2 * Math.cosh(u)), `${r3(Math.sinh(u))}*sqrt(c^2 - 4)`]), 1);
  const left = polyline("L", us.map((u) => [r3(-2 * Math.cosh(u)), `${r3(Math.sinh(u))}*sqrt(c^2 - 4)`]), 1);
  const d1 = "sqrt((2cosh(u) + c)^2 + (c^2 - 4)(sinh(u))^2)";
  const d2 = "sqrt((2cosh(u) - c)^2 + (c^2 - 4)(sinh(u))^2)";
  return {
    view: [-8, 8, -6, 6],
    grid: true,
    params: [
      { name: "c", tex: md`c \text{ (center to focus)}`, min: 2.5, max: 4.5, step: 0.5, value: 3 },
      { name: "u", tex: md`\text{position of } P`, min: -1.5, max: 1.5, step: 0.1, value: 0.8 },
    ],
    points: [
      ...right.points,
      ...left.points,
      { name: "F1", x: "-c", y: 0, label: md`F_1`, dir: "s" },
      { name: "F2", x: "c", y: 0, label: md`F_2`, dir: "s" },
      { name: "V1", x: -2, y: 0, label: md`V_1`, dir: "nw" },
      { name: "V2", x: 2, y: 0, label: md`V_2`, dir: "ne" },
      { name: "P", x: "2cosh(u)", y: "sqrt(c^2 - 4) sinh(u)", dir: "e" },
    ],
    segments: [...right.segments, ...left.segments, { from: "P", to: "F1", color: 3 }, { from: "P", to: "F2", color: 2 }],
    readouts: [
      { label: md`PF_1`, value: d1 },
      { label: md`PF_2`, value: d2 },
      { label: md`PF_1 - PF_2`, value: `${d1} - ${d2}` },
    ],
    caption: md`Here $a = 2$. Slide $P$ along the right branch: both distances change, but their difference stays $4 = 2a$. On the left branch the difference would be $-4$. Slide $c$ outward: the foci move away and the branches open wider.`,
  };
})();

const hyperbolasLesson: Lesson = {
  id: slug("Hyperbolas"),
  title: "Hyperbolas",
  summary: "Change the ellipse's sum to a difference: two branches, a right triangle with c as hypotenuse, and asymptotes you can prove.",
  blocks: [
    {
      kind: "text" as const,
      body: md`Change one word in the ellipse's definition, *sum* to *difference*, and the curve breaks into two branches that run off toward infinity along straight lines. Hyperbolas show up wherever a difference is what you measure: two radio stations send a pulse at the same moment, a ship hears them a fraction of a second apart, and that time gap fixes the difference of its distances to the stations. The ship is somewhere on a known hyperbola. A second pair of stations gives a second hyperbola, and the ship is where they cross.`,
    },
    {
      kind: "key" as const,
      title: "Hyperbola",
      body: md`Fix two points $F_1$ and $F_2$ (the **foci**) and a number $2a$ smaller than the distance $F_1F_2 = 2c$. The hyperbola is the set of points $P$ with

$$|PF_1 - PF_2| = 2a.$$

The **center** is the midpoint of the foci. The **transverse axis** is the segment between the two **vertices**, the points of the curve on the line through the foci; it has length $2a$. Perpendicular to it through the center is the **conjugate axis**, of length $2b$, where $b^2 = c^2 - a^2$.`,
    },
    { kind: "diagram" as const, ...hyperbolaLocus },
    {
      kind: "why" as const,
      title: "Why 2a < 2c, and why there are two branches",
      body: md`The triangle inequality gives $|PF_1 - PF_2| \le F_1F_2 = 2c$ for every point $P$, with equality only for points on the line through the foci and outside the segment between them. So a difference of exactly $2c$ gives two rays, not a curve, and a larger difference gives nothing. A real hyperbola needs $a < c$.

The absolute value hides two equations. $PF_1 - PF_2 = 2a$ describes the points closer to $F_2$: the branch wrapped around $F_2$. $PF_1 - PF_2 = -2a$ describes the branch around $F_1$. Each vertex is $a$ from the center, by the same argument as for the ellipse: at the vertex nearer $F_2$, with distance $d$ to $F_2$, the distance to $F_1$ is $2c - d$, so $2c - 2d = 2a$ and $d = c - a$.`,
    },
    {
      kind: "proof" as const,
      title: "The equation of a hyperbola",
      given: md`Foci $F_1(-c, 0)$ and $F_2(c, 0)$, a number $0 < a < c$, and a point $P(x, y)$ with $PF_1 - PF_2 = \pm 2a$`,
      prove: md`$\dfrac{x^2}{a^2} - \dfrac{y^2}{b^2} = 1$, where $b^2 = c^2 - a^2$`,
      steps: [
        { statement: md`$\sqrt{(x + c)^2 + y^2} = \pm 2a + \sqrt{(x - c)^2 + y^2}$`, reason: "Distance formula, with one root isolated." },
        { statement: md`$(x + c)^2 + y^2 = 4a^2 \pm 4a\sqrt{(x - c)^2 + y^2} + (x - c)^2 + y^2$`, reason: md`Square both sides. $(\pm 2a)^2 = 4a^2$ either way.` },
        { statement: md`$cx - a^2 = \pm a\sqrt{(x - c)^2 + y^2}$`, reason: md`$(x + c)^2 - (x - c)^2 = 4cx$, the $y^2$ terms cancel, and divide by 4.` },
        { statement: md`$c^2x^2 - 2a^2cx + a^4 = a^2x^2 - 2a^2cx + a^2c^2 + a^2y^2$`, reason: md`Square again; the sign $\pm$ disappears.` },
        { statement: md`$(c^2 - a^2)x^2 - a^2y^2 = a^2(c^2 - a^2)$`, reason: md`Cancel $-2a^2cx$, collect the $x^2$ terms on the left and the constants on the right.` },
        { statement: md`$b^2x^2 - a^2y^2 = a^2b^2$`, reason: md`Name $c^2 - a^2 = b^2$, positive because $c > a$.` },
        { statement: md`$\dfrac{x^2}{a^2} - \dfrac{y^2}{b^2} = 1$`, reason: md`Divide by $a^2b^2$.` },
      ],
    },
    {
      kind: "why" as const,
      title: "What b means here",
      body: md`For the ellipse, $b$ was a distance you could see: center to co-vertex. Here, put $x = 0$ and the equation says $-y^2/b^2 = 1$, impossible. The curve never crosses the conjugate axis, and no point of it is $b$ from anything obvious.

So $b^2 = c^2 - a^2$ is a name. Notice the roles have swapped: now $c$ is the largest, and $a^2 + b^2 = c^2$ makes $c$ the hypotenuse of the right triangle. The payoff for naming $b$ comes next: $b$ sets the slopes of the two lines the branches hug.`,
    },
    {
      kind: "key" as const,
      title: "Standard forms",
      body: md`With center $(h, k)$ and $c^2 = a^2 + b^2$:

- **Horizontal transverse axis:** $\dfrac{(x - h)^2}{a^2} - \dfrac{(y - k)^2}{b^2} = 1$. Vertices $(h \pm a, k)$, foci $(h \pm c, k)$, asymptotes $y - k = \pm\dfrac{b}{a}(x - h)$.
- **Vertical transverse axis:** $\dfrac{(y - k)^2}{a^2} - \dfrac{(x - h)^2}{b^2} = 1$. Vertices $(h, k \pm a)$, foci $(h, k \pm c)$, asymptotes $y - k = \pm\dfrac{a}{b}(x - h)$.

The **positive** term names the transverse axis, and $a^2$ is always its denominator, whether or not it is the bigger number. To sketch: draw the box with corners $(h \pm a, k \pm b)$; its diagonals, extended, are the asymptotes, and the branches start at the vertices and bend toward them.`,
    },
    {
      kind: "why" as const,
      title: "Why the asymptotes",
      body: md`Take the centered form and solve for $y$:

$$y = \pm\frac{b}{a}\sqrt{x^2 - a^2} = \pm\frac{b}{a}\,|x|\sqrt{1 - \frac{a^2}{x^2}}.$$

As $|x|$ grows, $\dfrac{a^2}{x^2}$ shrinks to 0 and the square root tends to 1, so $y$ behaves more and more like $\pm\dfrac{b}{a}x$. To see the gap close, take $x > 0$ and the upper branch, and rationalize:

$$\frac{b}{a}\left(x - \sqrt{x^2 - a^2}\right) = \frac{b}{a} \cdot \frac{x^2 - (x^2 - a^2)}{x + \sqrt{x^2 - a^2}} = \frac{ab}{x + \sqrt{x^2 - a^2}}.$$

The denominator grows without bound, so the gap goes to 0. It is always positive, so the branch stays just inside the line and never touches it. The lines $y = \pm\dfrac{b}{a}x$ are the diagonals of the box with half-width $a$ and half-height $b$.`,
    },
    {
      kind: "plot" as const,
      x: [-9, 9],
      y: [-6, 6],
      parametric: [
        { x: "a cosh(t)", y: "b sinh(t)", t: [-2.5, 2.5], label: "\\frac{x^2}{a^2} - \\frac{y^2}{b^2} = 1" },
        { x: "-a cosh(t)", y: "b sinh(t)", t: [-2.5, 2.5] },
      ],
      curves: [
        { expr: "b x/a", dashed: true, color: 2, label: "y = \\frac{b}{a}x" },
        { expr: "-b x/a", dashed: true, color: 2 },
      ],
      points: [
        { x: "sqrt(a^2 + b^2)", y: 0, label: "F_2", color: 4 },
        { x: "-sqrt(a^2 + b^2)", y: 0, label: "F_1", color: 4 },
        { x: "a", y: 0, label: "(a, 0)", color: 3 },
        { x: "-a", y: 0, label: "(-a, 0)", color: 3 },
      ],
      params: [
        { name: "a", min: 1, max: 4, step: 0.5, value: 2 },
        { name: "b", min: 1, max: 4, step: 0.5, value: 1.5 },
      ],
      caption: md`$c = \sqrt{a^2 + b^2} = {=sqrt(a^2 + b^2)}$, always beyond the vertices. Grow $b$ with $a$ fixed: the asymptotes steepen and the branches open wider, while the vertices stay put. The curve is drawn as $(a\cosh t, b\sinh t)$, which works because $\cosh^2 t - \sinh^2 t = 1$.`,
    },
    {
      kind: "example" as const,
      title: "Reading an equation",
      problem: md`Find the vertices, foci and asymptotes of $9x^2 - 16y^2 = 144$.`,
      steps: [
        { math: md`\frac{x^2}{16} - \frac{y^2}{9} = 1`, note: "Divide by 144." },
        { math: md`a = 4, \quad b = 3`, note: md`The positive term is in $x$: horizontal transverse axis. $a^2 = 16$ is its denominator.` },
        { math: md`c = \sqrt{16 + 9} = 5`, note: md`$c^2 = a^2 + b^2$.` },
        { math: md`(\pm 4, 0), \quad (\pm 5, 0), \quad y = \pm\tfrac{3}{4}x`, note: "Vertices, foci, asymptotes (rise b over run a)." },
      ],
    },
    {
      kind: "example" as const,
      title: "Vertical, with completing the square",
      problem: md`Find the center, vertices, foci and asymptotes of $4y^2 - 9x^2 - 8y - 36x - 68 = 0$.`,
      steps: [
        { math: md`4(y^2 - 2y) - 9(x^2 + 4x) = 68`, note: md`Group. The $x$-group has a negative coefficient, so it is subtracted.` },
        { math: md`4(y^2 - 2y + 1) - 9(x^2 + 4x + 4) = 68 + 4 - 36`, note: md`Adding 1 in the first group adds $4$; adding 4 in the second group **subtracts** $36$ because of the minus in front.` },
        { math: md`4(y - 1)^2 - 9(x + 2)^2 = 36 \;\Rightarrow\; \frac{(y - 1)^2}{9} - \frac{(x + 2)^2}{4} = 1`, note: "Divide by 36." },
        { math: md`\text{center } (-2, 1), \quad a = 3, \quad b = 2, \quad c = \sqrt{13}`, note: md`The positive term is in $y$: vertical transverse axis.` },
        { math: md`(-2, 4), (-2, -2); \quad (-2, 1 \pm \sqrt{13}); \quad y - 1 = \pm\tfrac{3}{2}(x + 2)`, note: md`Vertices, foci, asymptotes. For a vertical transverse axis the slopes are $\pm a/b$.` },
      ],
    },
    {
      kind: "example" as const,
      title: "From vertices and foci",
      problem: md`Write the equation of the hyperbola with vertices $(\pm 3, 0)$ and foci $(\pm 5, 0)$.`,
      steps: [
        { math: md`a = 3, \quad c = 5`, note: "Center at the origin, horizontal transverse axis." },
        { math: md`b^2 = c^2 - a^2 = 25 - 9 = 16`, note: md`Minus, not plus: $c$ is the hypotenuse.` },
        { math: md`\frac{x^2}{9} - \frac{y^2}{16} = 1`, note: md`Asymptotes $y = \pm\frac{4}{3}x$.` },
      ],
    },
    {
      kind: "text" as const,
      body: md`The eccentricity $e = \dfrac{c}{a}$ is now larger than 1. Near 1 means $b$ is small and the branches are narrow, hugging the transverse axis. Large $e$ means steep asymptotes and wide-open branches. One familiar curve is missing from this lesson: $y = \dfrac{1}{x}$ is a hyperbola too, with foci on the line $y = x$, but it has an $xy$ term and no $x^2$ or $y^2$. The next lesson shows how to turn it into a standard form.`,
    },
    {
      kind: "check" as const,
      prompt: md`Find the positive slope among the asymptotes of $\dfrac{x^2}{9} - \dfrac{y^2}{4} = 1$. Fractions are fine, like 3/4.`,
      answer: "2/3",
      explain: md`$a = 3$, $b = 2$, horizontal transverse axis: slopes $\pm\frac{b}{a} = \pm\frac{2}{3}$.`,
    },
    {
      kind: "check" as const,
      prompt: md`Find the focus of $\dfrac{y^2}{16} - \dfrac{x^2}{9} = 1$ with positive $y$-coordinate. Give it as a point, like (0, 3).`,
      answer: "(0, 5)",
      form: "tuple" as const,
      explain: md`The positive term is in $y$, so the transverse axis is vertical, $a = 4$, $b = 3$ and $c = \sqrt{16 + 9} = 5$. Foci $(0, \pm 5)$.`,
    },
  ],
  practice: [hyperbolaFeatures, hyperbolaGeneralForm, hyperbolaFromData],
};

// ── Lesson 4: Rotation of axes ──────────────────────────────────────────────

const classifyConic: Generator = (r) => {
  const type = r.pick(["ellipse", "parabola", "hyperbola", "hyperbola", "ellipse"] as const);
  let A = 0;
  let B = 0;
  let C = 0;
  if (type === "parabola") {
    const m = r.int(1, 3);
    [A, C] = r.pick([[1, m * m], [m * m, 1], [m, m], [-1, -(m * m)], [-m, -m]]) as [number, number];
    B = 2 * m * r.sign();
  } else {
    for (;;) {
      A = r.int(-5, 5);
      B = r.nonzero(-6, 6);
      C = r.int(-5, 5);
      const disc = B * B - 4 * A * C;
      if ((type === "ellipse" && disc < 0) || (type === "hyperbola" && disc > 0)) break;
    }
  }
  // Linear terms and constant that keep the graph real and non-degenerate: a nonzero 3x3 determinant rules out
  // points, lines and line pairs, and for an ellipse the constant must pull against the squared terms.
  let D = 0;
  let E = 0;
  let F = 0;
  for (;;) {
    D = r.int(-5, 5);
    E = r.int(-5, 5);
    F = type === "ellipse" ? -Math.sign(A) * r.int(1, 9) : r.nonzero(-9, 9);
    const det = A * (C * F - (E * E) / 4) - (B / 2) * ((B / 2) * F - (E * D) / 4) + (D / 2) * ((B * E) / 4 - (C * D) / 2);
    if (Math.abs(det) > 1e-9) break;
  }
  const disc = B * B - 4 * A * C;
  const eq = conicTex(A, B, C, D, E, F);
  return {
    prompt: md`The equation $${eq}$ has a real, non-degenerate graph. Use the discriminant $B^2 - 4AC$ to say which conic it is.`,
    choices: ["ellipse", "parabola", "hyperbola"],
    accept: [type],
    hint: md`Read off $A$, $B$, $C$ (the coefficients of $x^2$, $xy$, $y^2$). Negative means ellipse, zero means parabola, positive means hyperbola. The linear terms and constant don't matter.`,
    solution: [
      { math: md`A = ${A}, \quad B = ${B}, \quad C = ${C}`, note: md`Coefficients of $x^2$, $xy$ and $y^2$. The $x$, $y$ and constant terms only shift the curve.` },
      { math: md`B^2 - 4AC = ${B * B} - 4(${A})(${C}) = ${disc}`, note: "" },
      { math: md`\text{${type}}`, note: md`${disc < 0 ? "Negative: after rotating away the $xy$-term, both squared terms have the same sign." : disc === 0 ? "Zero: after rotating, one squared term vanishes." : "Positive: after rotating, the squared terms have opposite signs."}` },
    ],
  };
};

type AngleCase = { theta: number; two: number; cot: string; perK: number; root3: boolean };
const ANGLE_CASES: AngleCase[] = [
  { theta: 15, two: 30, cot: "\\sqrt{3}", perK: 3, root3: true },
  { theta: 30, two: 60, cot: "\\frac{1}{\\sqrt{3}}", perK: 1, root3: true },
  { theta: 45, two: 90, cot: "0", perK: 0, root3: false },
  { theta: 60, two: 120, cot: "-\\frac{1}{\\sqrt{3}}", perK: -1, root3: true },
  { theta: 75, two: 150, cot: "-\\sqrt{3}", perK: -3, root3: true },
  { theta: 22.5, two: 45, cot: "1", perK: 1, root3: false },
  { theta: 67.5, two: 135, cot: "-1", perK: -1, root3: false },
];

const rotationAngle: Generator = (r) => {
  const cs = r.pick(ANGLE_CASES);
  const k = r.pick([-4, -3, -2, -1, 1, 2, 3, 4]);
  const C = cs.perK === 0 ? r.nonzero(-5, 6) : r.int(-4, 5);
  const A = C + cs.perK * k;
  const D = r.int(-5, 5);
  const E = r.int(-5, 5);
  const F = r.nonzero(-9, 9);
  const eq = conicTex(A, k, C, D, E, F, cs.root3);
  const Btex = cs.root3 ? `${k === 1 ? "" : k === -1 ? "-" : k}\\sqrt{3}` : String(k);
  const Btext = cs.root3 ? `(${k} sqrt(3))` : String(k);
  return {
    prompt: md`Find the angle $\theta$, with $0^\circ < \theta < 90^\circ$, through which the axes must be rotated to remove the $xy$-term from $${eq}$. Answer in degrees, like 22.5.`,
    answer: String(cs.theta),
    verify: [`cot(2 t pi/180) = (${A - C})/${Btext}`],
    hint: md`$\cot 2\theta = \dfrac{A - C}{B}$. Find $2\theta$ between $0^\circ$ and $180^\circ$, then halve it. ${cs.root3 ? "Expect a $\\sqrt{3}$ to appear or cancel." : ""}`,
    solution: [
      { math: md`A = ${A}, \quad B = ${Btex}, \quad C = ${C}`, note: md`Coefficients of $x^2$, $xy$ and $y^2$.` },
      {
        math: md`\cot 2\theta = \frac{A - C}{B} = \frac{${A - C}}{${Btex}} = ${cs.cot}`,
        note: cs.perK === 0 ? md`$A = C$, so the numerator is 0.` : cs.root3 ? md`Simplify the fraction; ${Math.abs(cs.perK) === 3 ? "$3/\\sqrt{3} = \\sqrt{3}$" : "$1/\\sqrt{3}$ stays as it is"}, and the signs of the top and bottom decide the sign.` : "",
      },
      { math: md`2\theta = ${cs.two}^\circ \;\Rightarrow\; \theta = ${cs.theta}^\circ`, note: md`$\cot$ takes each value exactly once between $0^\circ$ and $180^\circ$${cs.two > 90 ? ", and a negative cotangent means $2\\theta$ is in the second quadrant" : ""}.` },
    ],
  };
};

const rotatedCoefficients: Generator = (r) => {
  const theta = r.pick([45, 30, 60]);
  let Ap = 0;
  let Cp = 0;
  for (;;) {
    Ap = r.nonzero(-6, 9);
    Cp = r.nonzero(-6, 9);
    if (Ap === Cp) continue;
    if (theta === 45 ? (Ap + Cp) % 2 === 0 : (Ap - Cp) % 2 === 0 && (3 * Ap + Cp) % 4 === 0) break;
  }
  let A: number;
  let C: number;
  let k: number;
  const root3 = theta !== 45;
  if (theta === 45) {
    A = C = (Ap + Cp) / 2;
    k = Ap - Cp;
  } else if (theta === 30) {
    A = (3 * Ap + Cp) / 4;
    C = (Ap + 3 * Cp) / 4;
    k = (Ap - Cp) / 2;
  } else {
    A = (Ap + 3 * Cp) / 4;
    C = (3 * Ap + Cp) / 4;
    k = (Ap - Cp) / 2;
  }
  // Same-sign A', C' need a constant of the opposite sign, or the curve has no points.
  const magnitude = r.pick([4, 8, 12, 16, 36]);
  const F = Ap * Cp > 0 ? -Math.sign(Ap) * magnitude : r.sign() * magnitude;
  const B2 = root3 ? 3 * k * k : k * k;
  const eq = conicTex(A, k, C, 0, 0, F, root3);
  const Btex = root3 ? `${k === 1 ? "" : k === -1 ? "-" : k}\\sqrt{3}` : String(k);
  const cot = theta === 45 ? "0" : theta === 30 ? "\\frac{1}{\\sqrt{3}}" : "-\\frac{1}{\\sqrt{3}}";
  const [cosT, sinT] = theta === 45 ? ["\\frac{\\sqrt{2}}{2}", "\\frac{\\sqrt{2}}{2}"] : theta === 30 ? ["\\frac{\\sqrt{3}}{2}", "\\frac{1}{2}"] : ["\\frac{1}{2}", "\\frac{\\sqrt{3}}{2}"];
  const [cos2, sin2, sc] = theta === 45 ? ["\\frac{1}{2}", "\\frac{1}{2}", "\\frac{1}{2}"] : theta === 30 ? ["\\frac{3}{4}", "\\frac{1}{4}", "\\frac{\\sqrt{3}}{4}"] : ["\\frac{1}{4}", "\\frac{3}{4}", "\\frac{\\sqrt{3}}{4}"];
  const Bsc = root3 ? fracTex(3 * k, 4) : fracTex(k, 2); // B sin cos
  return {
    prompt: md`Rotate the axes through the acute angle $\theta$ that removes the $xy$-term from $${eq}$. The equation becomes $A'x'^2 + C'y'^2 ${signed(F)} = 0$. Give $(A', C')$ as a tuple, like (4, 16).`,
    answer: `(${Ap}, ${Cp})`,
    form: "tuple",
    verify: [`a + c = ${A + C}`, `4ac = ${4 * A * C - B2}`],
    hint: md`First find $\theta$ from $\cot 2\theta = \frac{A - C}{B}$. Then $A' = A\cos^2\theta + B\sin\theta\cos\theta + C\sin^2\theta$, and the shortcut $A' + C' = A + C$ gives $C'$.`,
    solution: [
      { math: md`\cot 2\theta = \frac{${A} - ${paren(C)}}{${Btex}} = ${cot} \;\Rightarrow\; \theta = ${theta}^\circ`, note: md`$2\theta = ${2 * theta}^\circ$.` },
      { math: md`\cos\theta = ${cosT}, \quad \sin\theta = ${sinT}`, note: md`So $\cos^2\theta = ${cos2}$, $\sin^2\theta = ${sin2}$ and $\sin\theta\cos\theta = ${sc}$.` },
      {
        math: md`A' = A\cos^2\theta + B\sin\theta\cos\theta + C\sin^2\theta = ${A} \cdot ${cos2} + ${Bsc} + ${paren(C)} \cdot ${sin2} = ${Ap}`,
        note: md`$B\sin\theta\cos\theta = ${Btex} \cdot ${sc} = ${Bsc}$${root3 ? ", since $\\sqrt{3} \\cdot \\sqrt{3} = 3$" : ""}.`,
      },
      { math: md`C' = (A + C) - A' = ${A + C} - ${paren(Ap)} = ${Cp}`, note: md`$A' + C' = A + C$ for every rotation, so there is no need to compute $C'$ from its own formula.` },
      { math: md`${poly([[Ap, "x'^2"], [Cp, "y'^2"], [F, ""]])} = 0`, note: md`No $x'y'$ term, as designed. ${Ap * Cp > 0 ? "Same signs: an ellipse." : "Opposite signs: a hyperbola."}` },
    ],
  };
};

const rotationDiagram: DiagramSpec = {
  view: [-6, 6, -6, 6],
  grid: true,
  params: [{ name: "t", tex: md`\theta`, min: 0, max: 90, step: 5, value: 30 }],
  points: [
    { name: "O", x: 0, y: 0, label: "", dir: "sw" },
    { name: "X0", x: "-6cos(t pi/180)", y: "-6sin(t pi/180)", hidden: true, label: "" },
    { name: "X1", x: "6cos(t pi/180)", y: "6sin(t pi/180)", hidden: true, label: md`x'`, dir: "e" },
    { name: "Y0", x: "6sin(t pi/180)", y: "-6cos(t pi/180)", hidden: true, label: "" },
    { name: "Y1", x: "-6sin(t pi/180)", y: "6cos(t pi/180)", hidden: true, label: md`y'`, dir: "n" },
    { name: "Q", x: "4cos(t pi/180)", y: "4sin(t pi/180)", hidden: true, label: "" },
    { name: "P", x: "4cos(t pi/180) - 2sin(t pi/180)", y: "4sin(t pi/180) + 2cos(t pi/180)", label: md`P`, dir: "ne" },
    { name: "Px", x: "4cos(t pi/180) - 2sin(t pi/180)", y: 0, hidden: true, label: "" },
    { name: "Py", x: 0, y: "4sin(t pi/180) + 2cos(t pi/180)", hidden: true, label: "" },
  ],
  segments: [
    { from: "X0", to: "X1", color: 2, arrow: true },
    { from: "Y0", to: "Y1", color: 2, arrow: true },
    { from: "O", to: "Q", color: 3, label: md`x' = 4` },
    { from: "Q", to: "P", color: 3, dashed: true, label: md`y' = 2` },
    { from: "P", to: "Px", dashed: true },
    { from: "P", to: "Py", dashed: true },
  ],
  angles: [{ at: "O", from: "Px", to: "Q", label: md`\theta`, color: 2 }],
  readouts: [
    { label: md`x = 4\cos\theta - 2\sin\theta`, value: "4cos(t pi/180) - 2sin(t pi/180)" },
    { label: md`y = 4\sin\theta + 2\cos\theta`, value: "4sin(t pi/180) + 2cos(t pi/180)" },
  ],
  caption: md`The orange axes are the old ones turned by $\theta$. The point $P$ is pinned to them: its new coordinates are always $(x', y') = (4, 2)$. Slide $\theta$ and watch its old coordinates $(x, y)$ change, following the formulas below.`,
};

const rotationLesson: Lesson = {
  id: slug("Rotation of axes"),
  title: "Rotation of axes",
  summary: "Where an xy term comes from, the rotation that removes it, and why B² − 4AC tells you the conic before you do any work.",
  blocks: [
    {
      kind: "text" as const,
      body: md`Every equation so far had no $xy$ term, and every conic sat with its axes parallel to the coordinate axes. The graph of $xy = 1$ is a hyperbola too (it is $y = 1/x$ from Unit 2), tilted $45^\circ$. The general second-degree equation

$$Ax^2 + Bxy + Cy^2 + Dx + Ey + F = 0$$

allows a $Bxy$ term, and $B \ne 0$ is exactly the signature of a tilt. The cure is to tilt the axes to match the curve.`,
    },
    {
      kind: "key" as const,
      title: "Rotation formulas",
      body: md`Turn the axes counterclockwise through an angle $\theta$ to get new axes $x'$ and $y'$. A point whose new coordinates are $(x', y')$ has old coordinates

$$x = x'\cos\theta - y'\sin\theta, \qquad y = x'\sin\theta + y'\cos\theta.$$

Going the other way (rotate by $-\theta$): $x' = x\cos\theta + y\sin\theta$ and $y' = -x\sin\theta + y\cos\theta$.`,
    },
    {
      kind: "why" as const,
      title: "Where the formulas come from",
      body: md`Let $P$ be at distance $r$ from the origin, at angle $\beta$ measured from the new $x'$-axis. In the new system, $x' = r\cos\beta$ and $y' = r\sin\beta$ (Trigonometry, Unit 1). Measured from the old $x$-axis, the angle of $P$ is $\beta + \theta$, so

$$x = r\cos(\beta + \theta) = r\cos\beta\cos\theta - r\sin\beta\sin\theta = x'\cos\theta - y'\sin\theta,$$

by the cosine sum formula. The sine sum formula gives $y = r\sin(\beta + \theta) = x'\sin\theta + y'\cos\theta$ the same way. Nothing about $P$ changed; only the axes we describe it from.`,
    },
    { kind: "diagram" as const, ...rotationDiagram },
    {
      kind: "why" as const,
      title: "What happens to the equation",
      body: md`Substitute the rotation formulas into $Ax^2 + Bxy + Cy^2$ and expand. The result is again a quadratic in $x'$ and $y'$:

$$A'x'^2 + B'x'y' + C'y'^2,$$

with

- $A' = A\cos^2\theta + B\sin\theta\cos\theta + C\sin^2\theta$,
- $B' = 2(C - A)\sin\theta\cos\theta + B(\cos^2\theta - \sin^2\theta) = (C - A)\sin 2\theta + B\cos 2\theta$,
- $C' = A\sin^2\theta - B\sin\theta\cos\theta + C\cos^2\theta$.

The linear terms $Dx + Ey$ become new linear terms and $F$ is untouched. The whole game is to pick $\theta$ so that $B' = 0$. Then the equation has no cross term and the last three lessons take over.`,
    },
    {
      kind: "proof" as const,
      title: "The angle that removes the xy-term",
      given: md`$Ax^2 + Bxy + Cy^2 + Dx + Ey + F = 0$ with $B \ne 0$`,
      prove: md`Rotating the axes by the $\theta$ in $(0^\circ, 90^\circ)$ with $\cot 2\theta = \dfrac{A - C}{B}$ gives an equation with no $x'y'$ term`,
      steps: [
        { statement: md`$x^2 = x'^2\cos^2\theta - 2x'y'\sin\theta\cos\theta + y'^2\sin^2\theta$`, reason: md`Square $x = x'\cos\theta - y'\sin\theta$.` },
        { statement: md`$xy = x'^2\sin\theta\cos\theta + x'y'(\cos^2\theta - \sin^2\theta) - y'^2\sin\theta\cos\theta$`, reason: md`Multiply $(x'\cos\theta - y'\sin\theta)(x'\sin\theta + y'\cos\theta)$.` },
        { statement: md`$y^2 = x'^2\sin^2\theta + 2x'y'\sin\theta\cos\theta + y'^2\cos^2\theta$`, reason: md`Square $y = x'\sin\theta + y'\cos\theta$.` },
        { statement: md`$B' = -2A\sin\theta\cos\theta + B(\cos^2\theta - \sin^2\theta) + 2C\sin\theta\cos\theta$`, reason: md`Collect the $x'y'$ coefficients from $A x^2 + Bxy + Cy^2$.` },
        { statement: md`$B' = B\cos 2\theta - (A - C)\sin 2\theta$`, reason: md`Double-angle formulas: $2\sin\theta\cos\theta = \sin 2\theta$ and $\cos^2\theta - \sin^2\theta = \cos 2\theta$.` },
        { statement: md`$B' = 0 \iff B\cos 2\theta = (A - C)\sin 2\theta \iff \cot 2\theta = \dfrac{A - C}{B}$`, reason: md`For $0^\circ < 2\theta < 180^\circ$, $\sin 2\theta \ne 0$, so dividing by $B\sin 2\theta$ is allowed.` },
        { statement: md`Such a $\theta$ exists and is unique`, reason: md`On $(0^\circ, 180^\circ)$ the cotangent decreases from $+\infty$ to $-\infty$ and takes every real value exactly once, so $2\theta$ is determined, and $\theta$ with it.` },
      ],
    },
    {
      kind: "key" as const,
      title: "The procedure",
      body: md`- Compute $\cot 2\theta = \dfrac{A - C}{B}$ and find $2\theta$ in $(0^\circ, 180^\circ)$; then $\theta$ is acute.
- Find $\sin\theta$ and $\cos\theta$. If $2\theta$ isn't a familiar angle, use the half-angle formulas $\cos\theta = \sqrt{\dfrac{1 + \cos 2\theta}{2}}$ and $\sin\theta = \sqrt{\dfrac{1 - \cos 2\theta}{2}}$, both positive since $\theta$ is acute.
- Compute $A'$ from its formula. Then $C' = A + C - A'$, because $A' + C' = A + C$ (proved below).
- Rotate the linear terms too: $Dx + Ey = D(x'\cos\theta - y'\sin\theta) + E(x'\sin\theta + y'\cos\theta)$.
- Complete the squares in $x'$ and $y'$ as in the earlier lessons.`,
    },
    {
      kind: "example" as const,
      title: "The tilted hyperbola xy = 1",
      problem: md`Rotate the axes to remove the $xy$-term from $xy = 1$, and identify the curve.`,
      steps: [
        { math: md`A = 0, \; B = 1, \; C = 0 \;\Rightarrow\; \cot 2\theta = 0, \; 2\theta = 90^\circ, \; \theta = 45^\circ`, note: "" },
        { math: md`x = \frac{x' - y'}{\sqrt{2}}, \qquad y = \frac{x' + y'}{\sqrt{2}}`, note: md`$\cos 45^\circ = \sin 45^\circ = \frac{1}{\sqrt{2}}$.` },
        { math: md`xy = \frac{(x' - y')(x' + y')}{2} = \frac{x'^2 - y'^2}{2} = 1`, note: "A difference of squares." },
        { math: md`\frac{x'^2}{2} - \frac{y'^2}{2} = 1`, note: md`A hyperbola with $a = b = \sqrt{2}$ along the $x'$-axis. Its vertices $(\pm\sqrt{2}, 0)$ in new coordinates are $(1, 1)$ and $(-1, -1)$ in old ones, which is where $y = 1/x$ comes closest to the origin. Its asymptotes $y' = \pm x'$ are the old coordinate axes.` },
      ],
    },
    {
      kind: "example" as const,
      title: "An ellipse in disguise",
      problem: md`Put $7x^2 - 6\sqrt{3}\,xy + 13y^2 - 16 = 0$ into standard form.`,
      steps: [
        { math: md`\cot 2\theta = \frac{7 - 13}{-6\sqrt{3}} = \frac{1}{\sqrt{3}} \;\Rightarrow\; 2\theta = 60^\circ, \; \theta = 30^\circ`, note: "" },
        { math: md`\cos\theta = \frac{\sqrt{3}}{2}, \quad \sin\theta = \frac{1}{2}`, note: "" },
        { math: md`A' = 7 \cdot \frac{3}{4} - 6\sqrt{3} \cdot \frac{\sqrt{3}}{4} + 13 \cdot \frac{1}{4} = \frac{21 - 18 + 13}{4} = 4`, note: md`$A\cos^2\theta + B\sin\theta\cos\theta + C\sin^2\theta$.` },
        { math: md`C' = (A + C) - A' = 20 - 4 = 16`, note: md`Using $A' + C' = A + C$.` },
        { math: md`4x'^2 + 16y'^2 = 16 \;\Rightarrow\; \frac{x'^2}{4} + y'^2 = 1`, note: md`An ellipse with $a = 2$ along the $x'$-axis and $b = 1$. Its major axis makes a $30^\circ$ angle with the old $x$-axis.` },
      ],
    },
    {
      kind: "plot" as const,
      x: [-4, 4],
      y: [-3, 3],
      parametric: [
        { x: "2cos(t)cos(w pi/180) - sin(t) sin(w pi/180)", y: "2cos(t) sin(w pi/180) + sin(t) cos(w pi/180)", t: [0, 6.2832], label: "\\frac{x'^2}{4} + y'^2 = 1" },
        { x: "t cos(w pi/180)", y: "t sin(w pi/180)", t: [-4, 4], dashed: true, color: 2, label: "x'" },
        { x: "-t sin(w pi/180)", y: "t cos(w pi/180)", t: [-4, 4], dashed: true, color: 2, label: "y'" },
      ],
      params: [{ name: "w", tex: md`\theta`, min: 0, max: 90, step: 5, value: 30 }],
      caption: md`The ellipse $\frac{x'^2}{4} + y'^2 = 1$ drawn on axes rotated by $\theta$. At $\theta = 30^\circ$ it is the curve $7x^2 - 6\sqrt{3}\,xy + 13y^2 = 16$ from the example. At $\theta = 0$ the $xy$ term is gone and the equation is just $x^2 + 4y^2 = 4$.`,
    },
    {
      kind: "why" as const,
      title: "Why A + C and B² − 4AC never change",
      body: md`Add the formulas for $A'$ and $C'$: the $B$ terms cancel and $\cos^2\theta + \sin^2\theta = 1$ twice, so $A' + C' = A + C$.

For the discriminant, subtract instead: $A' - C' = (A - C)\cos 2\theta + B\sin 2\theta$, and from the proof, $B' = B\cos 2\theta - (A - C)\sin 2\theta$. These are the two components of the vector $\langle A - C, B\rangle$ after a rotation through $2\theta$, and rotating a vector doesn't change its length:

$$(A' - C')^2 + B'^2 = (A - C)^2 + B^2.$$

Now expand to check that $B^2 - 4AC = (A - C)^2 + B^2 - (A + C)^2$. Both pieces on the right are unchanged by rotation, so $B'^2 - 4A'C' = B^2 - 4AC$ for every $\theta$.`,
    },
    {
      kind: "key" as const,
      title: "Classifying by the discriminant",
      body: md`For $Ax^2 + Bxy + Cy^2 + Dx + Ey + F = 0$ with a real, non-degenerate graph:

- $B^2 - 4AC < 0$: an **ellipse** (a circle when also $B = 0$ and $A = C$).
- $B^2 - 4AC = 0$: a **parabola**.
- $B^2 - 4AC > 0$: a **hyperbola**.

Degenerate cases (a single point, one or two lines, or no points at all) can hide behind any of the three signs; the discriminant can't see them.`,
    },
    {
      kind: "why" as const,
      title: "Why the discriminant decides",
      body: md`Rotate to remove the cross term. Then $B' = 0$, so the invariant says $B^2 - 4AC = B'^2 - 4A'C' = -4A'C'$. The equation is now $A'x'^2 + C'y'^2 + D'x' + E'y' + F = 0$, and completing squares gives one of three shapes:

- $A'$ and $C'$ the same sign ($A'C' > 0$, so $B^2 - 4AC < 0$): a sum of two squares equals a constant. An ellipse, or a point or nothing if the constant is zero or has the wrong sign.
- Opposite signs ($A'C' < 0$, so $B^2 - 4AC > 0$): a difference of squares equals a constant. A hyperbola, or two crossing lines if the constant is zero.
- One of them zero ($B^2 - 4AC = 0$): only one variable is squared. A parabola, or a pair of parallel lines, or one line.

So the sign of $B^2 - 4AC$ is the sign of $-A'C'$, and it tells you the shape before you rotate anything.`,
    },
    {
      kind: "contour" as const,
      x: [-4, 4],
      y: [-4, 4],
      expr: "a x^2 + b x y + c y^2",
      levels: [1, 4, 9],
      params: [
        { name: "a", tex: md`A`, min: -3, max: 3, step: 1, value: 2 },
        { name: "b", tex: md`B`, min: -4, max: 4, step: 1, value: 2 },
        { name: "c", tex: md`C`, min: -3, max: 3, step: 1, value: 3 },
      ],
      caption: md`Level curves $Ax^2 + Bxy + Cy^2 = 1, 4, 9$. Right now $B^2 - 4AC = {=b^2 - 4ac}$. Slide $B$ and watch the tilt grow with it; cross the point where $B^2 = 4AC$ (try $A = 1, B = 2, C = 1$) and the ellipses stretch into parallel lines, a degenerate parabola, then break into hyperbolas.`,
    },
    {
      kind: "check" as const,
      prompt: md`Find the acute angle $\theta$ that removes the $xy$-term from $xy = 4$. Answer in degrees.`,
      answer: "45",
      explain: md`$A = C = 0$ and $B = 1$, so $\cot 2\theta = 0$, $2\theta = 90^\circ$ and $\theta = 45^\circ$. The curve becomes $\frac{x'^2}{8} - \frac{y'^2}{8} = 1$.`,
    },
    {
      kind: "check" as const,
      prompt: md`Use the discriminant to classify $2x^2 + 4xy + 2y^2 - x = 0$.`,
      choices: ["ellipse", "parabola", "hyperbola"],
      accept: ["parabola"],
      explain: md`$B^2 - 4AC = 16 - 16 = 0$. Indeed $2x^2 + 4xy + 2y^2 = 2(x + y)^2$, a single squared quantity, and the $-x$ keeps it from degenerating.`,
    },
  ],
  practice: [classifyConic, rotationAngle, rotatedCoefficients],
};

// ── Unit ────────────────────────────────────────────────────────────────────

export const unit5: Unit = {
  title: "Conic Sections",
  lessons: [parabolasLesson, ellipsesLesson, hyperbolasLesson, rotationLesson],
};
