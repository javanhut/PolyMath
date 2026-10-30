import { frac, fracTex, gcd, paren, poly, signed, type Rng } from "../../math/random";
import { md, type DiagramSpec, type Figure, type Generator, type Step, type Unit } from "../types";

// ── Shared wording ──────────────────────────────────────────────────────────

const EXACT = "Give an exact number (a fraction like 7/2 is fine).";
const FORMULA_N = md`Type only the expression in $n$ (leave off $a_n =$), like 3n + 2.`;
const DIVERGES = ["diverges", "diverge", "divergent", "it diverges", "the series diverges", "no sum", "there is no sum", "does not converge", "doesn't converge", "it does not converge", "does not exist", "dne"];

// ── Exact fractions ─────────────────────────────────────────────────────────

/** A reduced fraction [numerator, denominator] with a positive denominator. */
type Q = [number, number];

function q(n: number, d = 1): Q {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return [n / g + 0, d / g];
}
const qadd = (a: Q, b: Q) => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const qsub = (a: Q, b: Q) => qadd(a, [-b[0], b[1]]);
const qmul = (a: Q, b: Q) => q(a[0] * b[0], a[1] * b[1]);
const qdiv = (a: Q, b: Q) => q(a[0] * b[1], a[1] * b[0]);
const qpow = (a: Q, e: number) => q(a[0] ** e, a[1] ** e);
const qabs = (a: Q): Q => [Math.abs(a[0]), a[1]];
const qText = (a: Q) => frac(a[0], a[1]);
const qTex = (a: Q) => fracTex(a[0], a[1]);
const isInt = (a: Q) => a[1] === 1;
const ONE: Q = [1, 1];

/** r^e as LaTeX, with brackets around a negative or fractional base. */
function powTex(r: Q, e: string | number): string {
  const base = isInt(r) ? (r[0] < 0 ? `(${r[0]})` : String(r[0])) : md`\left(${qTex(r)}\right)`;
  return `${base}^{${e}}`;
}

/** A number in brackets when negative or a fraction, for the middle of a product. */
const qParen = (a: Q) => (isInt(a) && a[0] >= 0 ? String(a[0]) : md`\left(${qTex(a)}\right)`);

/** "+ 3" or "- \frac{3}{2}" for a term after the first in a sum. */
const signedTex = (t: Q) => `${t[0] < 0 ? "-" : "+"} ${qTex(qabs(t))}`;
const sumTex = (terms: Q[]) => terms.map((t, i) => (i === 0 ? qTex(t) : signedTex(t))).join(" ");
/** "a + b + c + \dots" or "a + b + c + \dots + z". */
const dotsSumTex = (head: Q[], last?: Q) => md`${sumTex(head)} + \dots${last ? ` ${signedTex(last)}` : ""}`;
const listTex = (terms: Q[]) => md`${terms.map(qTex).join(", ")}, \dots`;
/** The numbers added up in plain text, for hidden verify equations. */
const addText = (terms: Q[]) => terms.map((t) => `(${qText(t)})`).join(" + ");
const ints = (ns: number[]) => ns.map((n) => q(n));

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/** The terms a1, a1 r, ..., n of them. */
const geoTerms = (a1: Q, r: Q, n: number) => range(0, n - 1).map((k) => qmul(a1, qpow(r, k)));

// ── Lesson figures ──────────────────────────────────────────────────────────

/** 1 + 2 + ... + n in blue with the same sum reversed in orange on top: an n by (n + 1) rectangle. */
function staircase(n: number): DiagramSpec {
  const names = new Set<string>();
  const pt = (x: number, y: number) => {
    names.add(`${x},${y}`);
    return `P${x}_${y}`;
  };
  const polygons: DiagramSpec["polygons"] = [];
  const labels: DiagramSpec["labels"] = [];
  for (let k = 1; k <= n; k++) {
    polygons.push({ points: [pt(k - 1, 0), pt(k, 0), pt(k, k), pt(k - 1, k)], fill: 1 });
    polygons.push({ points: [pt(k - 1, k), pt(k, k), pt(k, n + 1), pt(k - 1, n + 1)], fill: 2 });
    labels.push({ x: k - 0.5, y: k / 2, text: String(k) });
    labels.push({ x: k - 0.5, y: k + (n + 1 - k) / 2, text: String(n + 1 - k) });
  }
  const points = [...names].map((s) => {
    const [x, y] = s.split(",").map(Number) as [number, number];
    return { name: `P${x}_${y}`, x, y, label: "", hidden: true };
  });
  return {
    view: [-0.5, n + 0.5, -0.5, n + 1.5],
    points,
    polygons,
    labels,
    caption: md`Blue: $1 + 2 + 3 + 4 + 5$. Orange: the same sum, backwards. Each column holds $6$, and there are $5$ columns, so two copies make $5 \cdot 6 = 30$ and one copy is $15$.`,
  };
}

/** Odd numbers as L-shaped layers of an n by n square. */
function oddSquares(n: number): DiagramSpec {
  const names = new Set<string>();
  const pt = (x: number, y: number) => {
    names.add(`${x},${y}`);
    return `P${x}_${y}`;
  };
  const polygons: DiagramSpec["polygons"] = [];
  const labels: DiagramSpec["labels"] = [];
  const segments: DiagramSpec["segments"] = [];
  for (let k = 1; k <= n; k++) {
    const fill = ([1, 2, 3, 4] as const)[(k - 1) % 4];
    polygons.push(
      k === 1
        ? { points: [pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1)], fill }
        : { points: [pt(k - 1, 0), pt(k, 0), pt(k, k), pt(0, k), pt(0, k - 1), pt(k - 1, k - 1)], fill },
    );
    labels.push({ x: k - 0.5, y: k - 0.5, text: String(2 * k - 1) });
  }
  for (let j = 1; j < n; j++) {
    segments.push({ from: pt(j, 0), to: pt(j, n), dashed: true });
    segments.push({ from: pt(0, j), to: pt(n, j), dashed: true });
  }
  const points = [...names].map((s) => {
    const [x, y] = s.split(",").map(Number) as [number, number];
    return { name: `P${x}_${y}`, x, y, label: "", hidden: true };
  });
  return {
    view: [-0.5, n + 0.5, -0.5, n + 0.5],
    points,
    segments,
    polygons,
    labels,
    caption: md`Each L-shaped layer adds the next odd number of squares: $1 + 3 + 5 + 7 + 9 = 25 = 5^2$.`,
  };
}

/** A square of area 1 cut into 1/2, 1/4, 1/8, ... */
const halvingSquare: DiagramSpec = {
  view: [-0.5, 8.5, -0.5, 8.5],
  points: [
    [0, 0], [4, 0], [8, 0], [0, 8], [4, 8], [8, 8], [4, 4], [8, 4], [6, 4], [6, 8], [6, 6], [8, 6], [7, 6], [7, 8], [7, 7], [8, 7],
  ].map(([x, y]) => ({ name: `P${x}_${y}`, x: x!, y: y!, label: "", hidden: true })),
  polygons: [
    { points: ["P0_0", "P4_0", "P4_8", "P0_8"], fill: 1 },
    { points: ["P4_0", "P8_0", "P8_4", "P4_4"], fill: 2 },
    { points: ["P4_4", "P6_4", "P6_8", "P4_8"], fill: 3 },
    { points: ["P6_4", "P8_4", "P8_6", "P6_6"], fill: 4 },
    { points: ["P6_6", "P7_6", "P7_8", "P6_8"], fill: 1 },
    { points: ["P7_6", "P8_6", "P8_7", "P7_7"], fill: 2 },
    { points: ["P0_0", "P8_0", "P8_8", "P0_8"], dashed: true },
  ],
  labels: [
    { x: 2, y: 4, text: md`\tfrac{1}{2}` },
    { x: 6, y: 2, text: md`\tfrac{1}{4}` },
    { x: 5, y: 6, text: md`\tfrac{1}{8}` },
    { x: 7, y: 5, text: md`\tfrac{1}{16}` },
  ],
  caption: md`A square of area 1. Shade half, then half of what's left, then half of that. Every piece stays inside the square, and the unshaded corner keeps halving. The shaded total is $\frac{1}{2} + \frac{1}{4} + \frac{1}{8} + \dots$, and the only number it can approach is 1.`,
};

/** Squares inside squares, each joining the midpoints of the last. */
function nestedSquares(side: number): Figure {
  let sq: [number, number][] = [
    [2, 2],
    [-2, 2],
    [-2, -2],
    [2, -2],
  ];
  const points: NonNullable<DiagramSpec["points"]> = [];
  const polygons: NonNullable<DiagramSpec["polygons"]> = [];
  for (let s = 0; s < 5; s++) {
    sq.forEach(([x, y], i) => points.push({ name: `S${s}_${i}`, x, y, label: "", hidden: true }));
    polygons.push({ points: range(0, 3).map((i) => `S${s}_${i}`), fill: s % 2 ? 2 : 1 });
    sq = sq.map(([x, y], i) => {
      const [u, v] = sq[(i + 1) % 4]!;
      return [(x + u) / 2, (y + v) / 2];
    });
  }
  return {
    kind: "diagram",
    view: [-2.6, 2.6, -2.8, 2.6],
    points,
    polygons,
    segments: [{ from: "S0_2", to: "S0_3", label: String(side) }],
  };
}

// ── Lesson 1: Arithmetic sequences ──────────────────────────────────────────

/** A first term and a nonzero common difference. */
function pickArith(r: Rng): [number, number] {
  return [r.int(-15, 25), r.nonzero(-9, 9)];
}

/** A first term and difference whose first n terms are all positive, so a written-out sum reads cleanly. */
function positiveArith(r: Rng, n: number): [number, number] {
  if (r.next() < 0.7) return [r.int(1, 20), r.int(1, 9)];
  const d = -r.int(1, 6);
  return [r.int(1, 15) - (n - 1) * d, d];
}

const arithmeticTerm: Generator = (r) => {
  const kind = r.int(0, 3);
  const [a1, d] = pickArith(r);
  const t = (n: number) => a1 + (n - 1) * d;
  if (kind === 0) {
    const N = r.int(12, 40);
    return {
      prompt: md`The arithmetic sequence $${listTex(ints([t(1), t(2), t(3), t(4)]))}$ keeps the same pattern. Find $a_{${N}}$.`,
      answer: String(t(N)),
      verify: [`x = (${t(1)}) + (${N} - 1)((${t(2)}) - (${t(1)}))`],
      hint: md`Find the common difference $d$ first. To get from $a_1$ to $a_{${N}}$ you add $d$ exactly ${N - 1} times.`,
      solution: [
        { math: md`d = ${t(2)} - ${paren(t(1))} = ${d}`, note: "Subtract any term from the one after it." },
        { math: md`a_{${N}} = a_1 + (${N} - 1)d = ${t(1)} + ${N - 1} \cdot ${paren(d)}`, note: md`Term ${N} is ${N - 1} steps of $d$ past the first term.` },
        { math: md`a_{${N}} = ${t(1)} ${signed((N - 1) * d)} = ${t(N)}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const N = r.int(10, 30);
    return {
      prompt: md`A sequence is defined by $a_1 = ${a1}$ and $a_n = a_{n-1} ${signed(d)}$ for $n \ge 2$. Find $a_{${N}}$.`,
      answer: String(t(N)),
      verify: [`x = (${a1}) + (${N} - 1)(${d})`],
      hint: md`Each term is the one before it ${d > 0 ? "plus" : "minus"} ${Math.abs(d)}, so this is arithmetic with $d = ${d}$. You don't need to list all ${N} terms.`,
      solution: [
        { math: md`a_1 = ${a1}, \quad d = ${d}`, note: "The recursive rule adds the same number every time: that number is d." },
        { math: md`a_{${N}} = ${a1} + (${N} - 1)(${d})`, note: md`Use $a_n = a_1 + (n - 1)d$ instead of stepping ${N - 1} times.` },
        { math: md`a_{${N}} = ${a1} ${signed((N - 1) * d)} = ${t(N)}`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const p = r.int(2, 6);
    const qq = p + r.int(2, 8);
    const N = r.int(15, 40);
    const [ap, aq] = [t(p), t(qq)];
    return {
      prompt: md`An arithmetic sequence has $a_{${p}} = ${ap}$ and $a_{${qq}} = ${aq}$. Find $a_{${N}}$.`,
      answer: String(t(N)),
      verify: [`(x - (${ap}))/(${N} - ${p}) = ((${aq}) - (${ap}))/(${qq} - ${p})`],
      hint: md`From term ${p} to term ${qq} is ${qq - p} steps of $d$. That pins down $d$.`,
      solution: [
        { math: md`${qq - p}d = a_{${qq}} - a_{${p}} = ${aq} - ${paren(ap)} = ${aq - ap}`, note: md`Going from position ${p} to position ${qq} adds $d$ exactly ${qq - p} times.` },
        { math: md`d = ${d}`, note: md`Divide by ${qq - p}.` },
        { math: md`a_{${N}} = a_{${qq}} + (${N} - ${qq})d = ${aq} + ${N - qq} \cdot ${paren(d)}`, note: md`Step forward from a term you know. Starting from $a_{${p}}$ works just as well.` },
        { math: md`a_{${N}} = ${t(N)}`, note: "" },
      ],
    };
  }
  const N = r.int(15, 60);
  return {
    prompt: md`Which term of the arithmetic sequence $${listTex(ints([t(1), t(2), t(3), t(4)]))}$ is $${t(N)}$? Give its position $n$.`,
    answer: String(N),
    verify: [`(${t(1)}) + (x - 1)(${d}) = ${t(N)}`],
    hint: md`Write the explicit formula $a_n = a_1 + (n - 1)d$, set it equal to ${t(N)}, and solve for $n$.`,
    solution: [
      { math: md`d = ${t(2)} - ${paren(t(1))} = ${d}`, note: "" },
      { math: md`${t(1)} + (n - 1)(${d}) = ${t(N)}`, note: "Set the nth term equal to the target." },
      { math: md`(n - 1)(${d}) = ${t(N) - t(1)}`, note: md`Subtract ${paren(t(1))}.` },
      { math: md`n - 1 = ${N - 1}, \quad n = ${N}`, note: md`Divide by ${paren(d)}. A whole-number answer confirms the value really is in the sequence.` },
    ],
  };
};

const arithmeticFormula: Generator = (r) => {
  const kind = r.int(0, 3);
  const [a1, d] = pickArith(r);
  const t = (n: number) => a1 + (n - 1) * d;
  const answer = poly([[d, "n"], [a1 - d, ""]]);
  const finish: Step[] = [
    { math: md`a_n = ${a1} + (n - 1)(${d})`, note: md`Use $a_n = a_1 + (n - 1)d$.` },
    { math: md`a_n = ${answer}`, note: md`Distribute and combine. Check: $n = 1$ gives $${d} ${signed(a1 - d)} = ${a1}$.` },
  ];
  if (kind === 0) {
    return {
      prompt: md`Write an explicit formula for $a_n$, the $n$th term of the arithmetic sequence $${listTex(ints([t(1), t(2), t(3), t(4)]))}$. ${FORMULA_N}`,
      answer,
      hint: md`Find $a_1$ and $d$, then use $a_n = a_1 + (n - 1)d$.`,
      solution: [{ math: md`a_1 = ${a1}, \quad d = ${t(2)} - ${paren(t(1))} = ${d}`, note: "The first term, and the step from each term to the next." }, ...finish],
    };
  }
  if (kind === 1) {
    return {
      prompt: md`An arithmetic sequence has first term $a_1 = ${a1}$ and common difference $d = ${d}$. Write an explicit formula for $a_n$. ${FORMULA_N}`,
      answer,
      hint: md`Reaching term $n$ takes $n - 1$ steps of $d$ from $a_1$.`,
      solution: finish,
    };
  }
  if (kind === 2) {
    return {
      prompt: md`A sequence is defined by $a_1 = ${a1}$ and $a_n = a_{n-1} ${signed(d)}$ for $n \ge 2$. Write an explicit formula for $a_n$. ${FORMULA_N}`,
      answer,
      hint: md`The recursive rule says $d = ${d}$. Turn it into $a_n = a_1 + (n - 1)d$.`,
      solution: [{ math: md`a_1 = ${a1}, \quad d = ${d}`, note: "Adding the same number each step makes it arithmetic." }, ...finish],
    };
  }
  const p = r.int(2, 5);
  const qq = p + r.int(2, 6);
  return {
    prompt: md`An arithmetic sequence has $a_{${p}} = ${t(p)}$ and $a_{${qq}} = ${t(qq)}$. Write an explicit formula for $a_n$. ${FORMULA_N}`,
    answer,
    hint: md`The ${qq - p} steps from term ${p} to term ${qq} give $d$. Then step back to $a_1$.`,
    solution: [
      { math: md`${qq - p}d = ${t(qq)} - ${paren(t(p))} = ${t(qq) - t(p)}, \quad d = ${d}`, note: "Divide the change in value by the number of steps." },
      { math: md`a_1 = a_{${p}} - ${p - 1}d = ${t(p)} - ${p - 1} \cdot ${paren(d)} = ${a1}`, note: md`Term ${p} is ${p - 1} steps after term 1, so walk back ${p - 1} steps.` },
      ...finish,
    ],
  };
};

const arithmeticSum: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 1) {
    const N = r.int(20, 100);
    const S = (N * (N + 1)) / 2;
    return {
      prompt: md`Find the sum $1 + 2 + 3 + \dots + ${N}$.`,
      answer: String(S),
      verify: [`x = ${addText(ints(range(1, N)))}`],
      hint: md`Pair the first and last terms, the second and second-to-last, and so on. Every pair has the same total.`,
      solution: [
        { math: md`n = ${N}, \quad a_1 = 1, \quad a_{${N}} = ${N}`, note: "Count the terms and read off the first and last." },
        { math: md`S_{${N}} = \frac{${N}(1 + ${N})}{2} = \frac{${N} \cdot ${N + 1}}{2}`, note: "Number of terms times the average of the first and last." },
        { math: String(S), note: "" },
      ],
    };
  }
  if (kind === 3) {
    const m = r.int(3, 9);
    const N = r.int(10, 30);
    const S = (m * N * (N + 1)) / 2;
    return {
      prompt: md`Find the sum of all the multiples of $${m}$ from $${m}$ to $${m * N}$.`,
      answer: String(S),
      verify: [`x = ${addText(ints(range(1, N).map((k) => m * k)))}`],
      hint: md`The multiples $${m}, ${2 * m}, ${3 * m}, \dots, ${m * N}$ form an arithmetic sequence. How many are there?`,
      solution: [
        { math: md`${m} + ${2 * m} + \dots + ${m * N}`, note: md`Arithmetic with $d = ${m}$. Since $${m * N} = ${m} \cdot ${N}$, there are ${N} terms.` },
        { math: md`S = \frac{${N}(${m} + ${m * N})}{2} = \frac{${N} \cdot ${m + m * N}}{2}`, note: "Number of terms times the average of the first and last." },
        { math: String(S), note: "" },
      ],
    };
  }
  const N = kind === 0 ? r.int(10, 30) : r.int(12, 30);
  const [a1, d] = kind === 0 ? pickArith(r) : positiveArith(r, N);
  const t = (n: number) => a1 + (n - 1) * d;
  const S = (N * (t(1) + t(N))) / 2;
  const verify = [`x = ${addText(ints(range(1, N).map(t)))}`];
  if (kind === 0) {
    return {
      prompt: md`Find the sum of the first ${N} terms of the arithmetic sequence $${listTex(ints([t(1), t(2), t(3)]))}$.`,
      answer: String(S),
      verify,
      hint: md`You need the last term, $a_{${N}}$. Then use $S_n = \frac{n(a_1 + a_n)}{2}$.`,
      solution: [
        { math: md`d = ${d}, \quad a_{${N}} = ${t(1)} + ${N - 1} \cdot ${paren(d)} = ${t(N)}`, note: "Find the last term from the explicit formula." },
        { math: md`S_{${N}} = \frac{${N}(${t(1)} + ${paren(t(N))})}{2} = \frac{${N} \cdot ${paren(t(1) + t(N))}}{2}`, note: "Each pair of first and last terms has the same total." },
        { math: String(S), note: "" },
      ],
    };
  }
  return {
    prompt: md`Find the sum of the arithmetic series $${dotsSumTex(ints([t(1), t(2), t(3)]), q(t(N)))}$.`,
    answer: String(S),
    verify,
    hint: md`First count the terms: solve $${t(1)} + (n - 1)(${d}) = ${t(N)}$ for $n$.`,
    solution: [
      { math: md`d = ${d}`, note: "" },
      { math: md`${t(1)} + (n - 1)(${d}) = ${t(N)} \implies n - 1 = ${N - 1}, \quad n = ${N}`, note: "The last term tells you how many terms there are." },
      { math: md`S_{${N}} = \frac{${N}(${t(1)} + ${paren(t(N))})}{2} = \frac{${N} \cdot ${paren(t(1) + t(N))}}{2}`, note: "Number of terms times the average of the first and last." },
      { math: String(S), note: "" },
    ],
  };
};

// ── Lesson 2: Geometric sequences ───────────────────────────────────────────

/** A first term that keeps the first `terms` terms whole for ratio r. */
function geoStart(r: Rng, ratio: Q, terms: number, negative = true): Q {
  const m = r.pick([1, 1, 2, 3, 5]) * (negative && r.next() < 0.15 ? -1 : 1);
  return q(m * ratio[1] ** (terms - 1));
}

const geometricTerm: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0 || kind === 1) {
    const ratio = r.pick<Q>([[2, 1], [3, 1], [-2, 1], [-3, 1], [1, 2], [-1, 2], [1, 3], [3, 2], [2, 3]]);
    const a1 = geoStart(r, ratio, 4);
    const N = r.int(5, Math.abs(ratio[0]) === 3 || ratio[1] === 3 ? 7 : 8);
    const aN = qmul(a1, qpow(ratio, N - 1));
    const steps: Step[] = [
      { math: md`a_{${N}} = a_1 r^{${N} - 1} = ${qTex(a1)} \cdot ${powTex(ratio, N - 1)}`, note: md`Term ${N} is ${N - 1} multiplications by $r$ past the first.` },
      { math: md`a_{${N}} = ${qTex(a1)} \cdot ${qParen(qpow(ratio, N - 1))} = ${qTex(aN)}`, note: ratio[0] < 0 ? md`A negative number to an ${(N - 1) % 2 ? "odd" : "even"} power is ${(N - 1) % 2 ? "negative" : "positive"}.` : "" },
    ];
    if (kind === 0) {
      const terms = geoTerms(a1, ratio, 4);
      return {
        prompt: md`The geometric sequence $${listTex(terms)}$ keeps the same pattern. Find $a_{${N}}$. ${EXACT}`,
        answer: qText(aN),
        verify: [`x = (${qText(terms[0]!)})((${qText(terms[1]!)})/(${qText(terms[0]!)}))^(${N} - 1)`],
        hint: md`Divide a term by the one before it to get $r$. Then $a_n = a_1 r^{n-1}$.`,
        solution: [{ math: md`r = \frac{${qTex(terms[1]!)}}{${qTex(terms[0]!)}} = ${qTex(ratio)}`, note: "Divide any term by the one before it." }, ...steps],
      };
    }
    return {
      prompt: md`A sequence is defined by $a_1 = ${qTex(a1)}$ and $a_n = ${qTex(ratio)}a_{n-1}$ for $n \ge 2$. Find $a_{${N}}$. ${EXACT}`,
      answer: qText(aN),
      verify: [`x = (${qText(a1)})(${qText(ratio)})^(${N} - 1)`],
      hint: md`Each term is the one before times $${qTex(ratio)}$, so it is geometric with $r = ${qTex(ratio)}$.`,
      solution: [{ math: md`a_1 = ${qTex(a1)}, \quad r = ${qTex(ratio)}`, note: "Multiplying by the same number each time makes it geometric." }, ...steps],
    };
  }
  if (kind === 2) {
    const ratio = r.pick<Q>([[2, 1], [3, 1], [-2, 1], [-3, 1], [1, 2], [-1, 2]]);
    const p = r.int(1, 2);
    const qq = p + 3;
    const a1 = geoStart(r, ratio, qq);
    const [ap, aq] = [qmul(a1, qpow(ratio, p - 1)), qmul(a1, qpow(ratio, qq - 1))];
    const cube = qpow(ratio, 3);
    return {
      prompt: md`A geometric sequence has $a_{${p}} = ${qTex(ap)}$ and $a_{${qq}} = ${qTex(aq)}$. Find the common ratio $r$. ${EXACT}`,
      answer: qText(ratio),
      verify: [`(${qText(ap)})x^3 = ${qText(aq)}`],
      hint: md`Getting from term ${p} to term ${qq} multiplies by $r$ three times, so $a_{${qq}} = a_{${p}} r^3$.`,
      solution: [
        { math: md`${qTex(ap)} \cdot r^3 = ${qTex(aq)}`, note: "Three multiplications by r lead from one term to the other." },
        { math: md`r^3 = ${qTex(cube)}`, note: md`Divide by $${qTex(ap)}$.` },
        { math: md`r = ${qTex(ratio)}`, note: md`$${qParen(ratio)}^3 = ${qTex(cube)}$, and only one real number has that cube.` },
      ],
    };
  }
  const ratio = r.pick([2, 3]);
  const a1 = r.pick([1, 2, 3, 5]);
  const N = r.int(5, ratio === 2 ? 11 : 8);
  const V = a1 * ratio ** (N - 1);
  return {
    prompt: md`Which term of the geometric sequence $${listTex(ints([a1, a1 * ratio, a1 * ratio ** 2]))}$ is $${V}$? Give its position $n$.`,
    answer: String(N),
    verify: [`${a1}(${ratio})^(x - 1) = ${V}`],
    hint: md`Set $a_1 r^{n-1}$ equal to ${V}. Divide by $a_1$ and ask which power of ${ratio} is left.`,
    solution: [
      { math: md`${a1 === 1 ? "" : `${a1} \\cdot `}${ratio}^{n-1} = ${V}`, note: md`Here $a_1 = ${a1}$ and $r = ${ratio}$.` },
      ...(a1 === 1 ? [] : [{ math: md`${ratio}^{n-1} = ${V / a1}`, note: md`Divide by ${a1}.` }]),
      { math: md`${ratio}^{n-1} = ${ratio}^{${N - 1}}`, note: md`Keep multiplying by ${ratio}: $${V / a1}$ is $${ratio}$ to the power ${N - 1}.` },
      { math: md`n - 1 = ${N - 1}, \quad n = ${N}`, note: "" },
    ],
  };
};

/** Four terms that are arithmetic, geometric, or neither. */
function classifyTerms(r: Rng, kind: "arithmetic" | "geometric" | "neither"): number[] {
  if (kind === "arithmetic") {
    const [a, d] = [r.int(-10, 20), r.nonzero(-7, 7)];
    return range(0, 3).map((k) => a + k * d);
  }
  if (kind === "geometric") {
    const ratio = r.pick([2, 3, -2, -3, 4]);
    const a = r.pick([1, 2, 3, 5, -2]);
    return range(0, 3).map((k) => a * ratio ** k);
  }
  for (;;) {
    const c = r.int(-3, 5);
    const [a, b] = [r.int(1, 4), r.int(2, 6)];
    const t = r.pick([
      [1 + c, 4 + c, 9 + c, 16 + c],
      [a, a + 1, a + 3, a + 6],
      [2, 6, 12, 20],
      [a, b, a + b, a + 2 * b],
      [1, -2, 3, -4],
      [a, a + b, a + 2 * b, a + 4 * b],
    ]);
    const diffs = t.slice(1).map((v, i) => v - t[i]!);
    const ratios = t.every((v) => v !== 0) ? t.slice(1).map((v, i) => v / t[i]!) : [1, 2];
    if (new Set(diffs).size > 1 && new Set(ratios).size > 1) return t;
  }
}

const geometricFormula: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 2) {
    const right = r.pick(["arithmetic", "geometric", "neither"] as const);
    const t = classifyTerms(r, right);
    const diffs = t.slice(1).map((v, i) => v - t[i]!);
    const ratios = t.slice(1).map((v, i) => q(v, t[i]!));
    const ratioTex = t.every((v) => v !== 0) ? ratios.map(qTex).join(", ") : md`\text{undefined (a term is 0)}`;
    return {
      prompt: md`Is the sequence $${listTex(ints(t))}$ arithmetic, geometric, or neither?`,
      choices: ["arithmetic", "geometric", "neither"],
      accept: [right],
      hint: "Work out the differences between neighbours, then the ratios. Is either one constant?",
      solution: [
        { math: md`\text{differences: } ${diffs.join(", ")}`, note: new Set(diffs).size === 1 ? "The differences are all equal." : "The differences change." },
        { math: md`\text{ratios: } ${ratioTex}`, note: right === "geometric" ? "The ratios are all equal." : t.includes(0) ? "A geometric sequence never has a 0 term, since r and the first term are nonzero." : "The ratios change." },
        { math: md`\text{${right}}`, note: right === "arithmetic" ? "Constant difference: arithmetic." : right === "geometric" ? "Constant ratio: geometric." : "Neither one is constant, so it is neither arithmetic nor geometric." },
      ],
    };
  }
  const ratio = r.pick<Q>([[2, 1], [3, 1], [4, 1], [1, 2], [1, 3], [3, 2], [2, 3], [1, 4]]);
  const a1 = geoStart(r, ratio, 4, false);
  const answer = `${qText(a1)}(${qText(ratio)})^(n - 1)`;
  const finish: Step = { math: md`a_n = ${qTex(a1)} \cdot ${powTex(ratio, "n-1")}`, note: md`Use $a_n = a_1 r^{n-1}$. Check: $n = 1$ gives $${qTex(a1)} \cdot ${qParen(ratio)}^0 = ${qTex(a1)}$.` };
  if (kind === 0) {
    const terms = geoTerms(a1, ratio, 4);
    return {
      prompt: md`Write an explicit formula for $a_n$, the $n$th term of the geometric sequence $${listTex(terms)}$. Type only the expression in $n$ (leave off $a_n =$), like 7(4)^(n - 1).`,
      answer,
      hint: md`Find $a_1$ and the ratio $r = \frac{a_2}{a_1}$, then use $a_n = a_1 r^{n-1}$.`,
      solution: [{ math: md`a_1 = ${qTex(a1)}, \quad r = \frac{${qTex(terms[1]!)}}{${qTex(terms[0]!)}} = ${qTex(ratio)}`, note: "" }, finish],
    };
  }
  return {
    prompt: md`A geometric sequence has first term $${qTex(a1)}$ and common ratio $${qTex(ratio)}$. Write an explicit formula for $a_n$. Type only the expression in $n$ (leave off $a_n =$), like 7(4)^(n - 1).`,
    answer,
    hint: md`Reaching term $n$ takes $n - 1$ multiplications by $r$.`,
    solution: [{ math: md`a_1 = ${qTex(a1)}, \quad r = ${qTex(ratio)}`, note: "" }, finish],
  };
};

/** The steps of S_n = a1 (1 - r^n)/(1 - r). */
function geoSumSteps(a1: Q, ratio: Q, n: number): { S: Q; steps: Step[] } {
  const rn = qpow(ratio, n);
  // For r > 1, use (r^n - 1)/(r - 1) so nothing is negative.
  const up = ratio[0] > ratio[1];
  const top = up ? qsub(rn, ONE) : qsub(ONE, rn);
  const bottom = up ? qsub(ratio, ONE) : qsub(ONE, ratio);
  const S = qmul(a1, qdiv(top, bottom));
  const first = up
    ? md`S_{${n}} = a_1 \cdot \frac{r^{${n}} - 1}{r - 1} = ${qTex(a1)} \cdot \frac{${powTex(ratio, n)} - 1}{${qTex(ratio)} - 1}`
    : md`S_{${n}} = a_1 \cdot \frac{1 - r^{${n}}}{1 - r} = ${qTex(a1)} \cdot \frac{1 - ${powTex(ratio, n)}}{1 - ${qParen(ratio)}}`;
  return {
    S,
    steps: [
      { math: first, note: md`$a_1 = ${qTex(a1)}$, $r = ${qTex(ratio)}$, and there are ${n} terms.${up ? " With r > 1, this form keeps the top and bottom positive." : ""}` },
      { math: md`S_{${n}} = ${qTex(a1)} \cdot \frac{${qTex(top)}}{${qTex(bottom)}}`, note: md`$${powTex(ratio, n)} = ${qTex(rn)}$.` },
      { math: md`S_{${n}} = ${qTex(S)}`, note: "" },
    ],
  };
}

const geometricSum: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 2) {
    const ratio = r.pick([2, 3]);
    const a = r.pick([1, 2, 3, 5]);
    const N = r.int(ratio === 2 ? 6 : 5, ratio === 2 ? 10 : 7);
    const terms = range(0, N - 1).map((k) => q(a * ratio ** k));
    const { S, steps } = geoSumSteps(q(a), q(ratio), N);
    return {
      prompt: md`On day 1 you put ${a} dollar${a === 1 ? "" : "s"} in a jar. Each day after that you put in ${ratio === 2 ? "twice" : "three times"} as much as the day before. How many dollars are in the jar after day ${N}?`,
      answer: qText(S),
      verify: [`x = ${addText(terms)}`],
      hint: md`The deposits $${sumTex(terms.slice(0, 3))} + \dots$ form a geometric series with ${N} terms.`,
      solution: [{ math: md`${dotsSumTex(terms.slice(0, 3), terms[N - 1])}`, note: md`Day ${N}'s deposit is $${a} \cdot ${ratio}^{${N - 1}} = ${a * ratio ** (N - 1)}$.` }, ...steps],
    };
  }
  if (kind === 3) {
    const N = r.int(5, 10);
    const terms = range(1, N).map((k) => q(2 ** k));
    const { S, steps } = geoSumSteps(q(2), q(2), N);
    return {
      prompt: md`You have 2 parents, 4 grandparents, 8 great-grandparents, and so on, doubling with each generation back. Counting each place in the family tree once, how many ancestors are in the first ${N} generations back?`,
      answer: qText(S),
      verify: [`x = ${addText(terms)}`],
      hint: md`Add $2 + 4 + 8 + \dots + 2^{${N}}$, a geometric series with ${N} terms.`,
      solution: [{ math: md`2 + 4 + 8 + \dots + ${2 ** N}`, note: md`Generation ${N} back has $2^{${N}} = ${2 ** N}$ places.` }, ...steps],
    };
  }
  if (kind === 0) {
    const ratio = r.pick<Q>([[2, 1], [3, 1], [-2, 1], [-3, 1], [1, 2], [-1, 2]]);
    const N = r.int(5, Math.abs(ratio[0]) === 3 ? 7 : 8);
    const a1 = isInt(ratio) ? q(r.pick([1, 2, 3, 4, 5])) : geoStart(r, ratio, N);
    const terms = geoTerms(a1, ratio, N);
    const { S, steps } = geoSumSteps(a1, ratio, N);
    return {
      prompt: md`Find the sum of the first ${N} terms of the geometric sequence $${listTex(terms.slice(0, 3))}$.`,
      answer: qText(S),
      verify: [`x = ${addText(terms)}`],
      hint: md`Find $r$, then use $S_n = a_1 \cdot \frac{1 - r^n}{1 - r}$ with $n = ${N}$.`,
      solution: [{ math: md`r = \frac{${qTex(terms[1]!)}}{${qTex(terms[0]!)}} = ${qTex(ratio)}`, note: "Divide a term by the one before it." }, ...steps],
    };
  }
  const ratio = r.pick<Q>([[2, 1], [3, 1], [1, 2], [1, 3]]);
  const N = r.int(5, ratio[0] === 3 || ratio[1] === 3 ? 7 : 8);
  const a1 = isInt(ratio) ? q(r.pick([1, 2, 3, 5])) : q(r.pick([1, 2, 3]) * ratio[1] ** (N - 1));
  const terms = geoTerms(a1, ratio, N);
  const { S, steps } = geoSumSteps(a1, ratio, N);
  const last = terms[N - 1]!;
  const big = isInt(ratio) ? ratio : qdiv(ONE, ratio);
  const factor = isInt(ratio) ? qdiv(last, a1) : qdiv(a1, last);
  return {
    prompt: md`Find the sum $${dotsSumTex(terms.slice(0, 3), last)}$.`,
    answer: qText(S),
    verify: [`x = ${addText(terms)}`],
    hint: md`It is geometric with $r = ${qTex(ratio)}$. Count the terms first: $a_1 r^{n-1}$ has to reach $${qTex(last)}$.`,
    solution: [
      { math: md`${qTex(a1)} \cdot ${powTex(ratio, "n-1")} = ${qTex(last)}`, note: md`$a_1 = ${qTex(a1)}$ and $r = ${qTex(ratio)}$. Set the nth term equal to the last one.` },
      { math: md`${powTex(ratio, "n-1")} = ${qTex(qdiv(last, a1))} = ${powTex(ratio, N - 1)}`, note: md`$${qTex(factor)} = ${qTex(big)}^{${N - 1}}$, so $n - 1 = ${N - 1}$ and there are ${N} terms.` },
      ...steps,
    ],
  };
};

// ── Lesson 3: Sigma notation ────────────────────────────────────────────────

/** A term of a sum in the index k: LaTeX, typed text (in k), and its value. */
interface Term {
  tex: string;
  text: string;
  f: (k: number) => number;
  /** The term is a sum, so it needs brackets after the sigma. */
  sum: boolean;
}

const linearTerm = (a: number, b: number): Term => ({ tex: poly([[a, "k"], [b, ""]]), text: poly([[a, "k"], [b, ""]]), f: (k) => a * k + b, sum: b !== 0 });
const sigmaTex = (lo: number | string, hi: number | string, t: Term) => md`\sum_{k=${lo}}^{${hi}} ${t.sum ? `(${t.tex})` : t.tex}`;
const at = (text: string, k: number | string) => text.replace(/k/g, `(${k})`);
/** A term's LaTeX with a value put in for k: 3k + 1 -> 3(2) + 1, 2^{k} -> 2^{2}, k^2 -> 2^2. */
const texAt = (tex: string, k: number) => tex.replace(/(\d)k/g, `$1(${k})`).replace(/k/g, String(k));
/** "k = 1, 2, 3" or "k = 4, 5, \dots, 9". */
const indexList = (lo: number, hi: number) => (hi - lo < 5 ? range(lo, hi).join(", ") : md`${lo}, ${lo + 1}, \dots, ${hi}`);
/** The sum written out term by term, for hidden verify equations. */
const expandText = (t: Term, lo: number, hi: number) => range(lo, hi).map((k) => `(${at(t.text, k)})`).join(" + ");

const evaluateSigma: Generator = (r) => {
  const kind = r.int(0, 4);
  let t: Term;
  let lo = 1;
  let hi: number;
  if (kind === 0 || kind === 3) {
    t = linearTerm(r.coef(-5, 6), r.nonzero(-6, 8));
    lo = kind === 3 ? r.int(2, 4) : 1;
    hi = lo + r.int(3, 5);
  } else if (kind === 1) {
    const c = r.nonzero(-4, 5);
    t = r.pick<Term>([
      { tex: "k^2", text: "k^2", f: (k) => k * k, sum: false },
      { tex: `k^2 ${signed(c)}`, text: `k^2 ${signed(c)}`, f: (k) => k * k + c, sum: true },
      { tex: "k^2 - k", text: "k^2 - k", f: (k) => k * k - k, sum: true },
      { tex: "2k^2", text: "2k^2", f: (k) => 2 * k * k, sum: false },
    ]);
    hi = r.int(3, 5);
  } else if (kind === 2) {
    const base = r.pick([2, 3]);
    const c = r.pick([1, 2, 3, 5]);
    t = { tex: `${c === 1 ? "" : `${c} \\cdot `}${base}^{k}`, text: `${c}*${base}^(k)`, f: (k) => c * base ** k, sum: false };
    lo = r.int(0, 1);
    hi = r.int(3, base === 2 ? 5 : 4);
  } else {
    const sq = r.next() < 0.4;
    t = sq
      ? { tex: md`(-1)^{k} \cdot k^2`, text: "(-1)^(k)*k^2", f: (k) => (-1) ** k * k * k, sum: false }
      : { tex: md`(-1)^{k+1} \cdot k`, text: "(-1)^(k+1)*k", f: (k) => (-1) ** (k + 1) * k, sum: false };
    hi = r.int(4, sq ? 5 : 7);
  }
  const values = range(lo, hi).map(t.f);
  const total = values.reduce((s, v) => s + v, 0);
  return {
    prompt: md`Evaluate $${sigmaTex(lo, hi, t)}$.`,
    answer: String(total),
    verify: [`x = ${expandText(t, lo, hi)}`],
    hint: md`Put $k = ${indexList(lo, hi)}$ into $${t.tex}$ one at a time, then add the results.`,
    solution: [
      { math: md`k = ${lo}: \quad ${texAt(t.tex, lo)} = ${values[0]}`, note: md`The index starts at ${lo}. There are $${hi} - ${lo} + 1 = ${hi - lo + 1}$ terms.` },
      { math: sumTex(ints(values)), note: "All the terms." },
      { math: String(total), note: "" },
    ],
  };
};

const sigmaFormulas: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const [a, b] = [r.int(2, 6), r.nonzero(-5, 9)];
    const n = r.int(20, 50);
    const t = linearTerm(a, b);
    const tri = (n * (n + 1)) / 2;
    return {
      prompt: md`Evaluate $${sigmaTex(1, n, t)}$.`,
      answer: String(a * tri + b * n),
      verify: [`x = ${expandText(t, 1, n)}`],
      hint: md`Split it: $${a}\sum k ${b < 0 ? "-" : "+"} \sum ${Math.abs(b)}$. You know $\sum_{k=1}^{n} k = \frac{n(n+1)}{2}$.`,
      solution: [
        { math: md`${a}\sum_{k=1}^{${n}} k ${b < 0 ? "-" : "+"} \sum_{k=1}^{${n}} ${Math.abs(b)}`, note: "Split the sum and pull the constant factor out." },
        { math: md`${a} \cdot \frac{${n} \cdot ${n + 1}}{2} ${b < 0 ? "-" : "+"} ${n} \cdot ${Math.abs(b)}`, note: md`Gauss's sum for the first part; ${n} copies of ${Math.abs(b)} for the second.` },
        { math: md`${a * tri} ${signed(b * n)} = ${a * tri + b * n}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const t = linearTerm(r.int(2, 6), r.int(-5, 9));
    const lo = r.int(5, 12);
    const hi = lo + r.int(10, 30);
    const m = hi - lo + 1;
    const [first, last] = [t.f(lo), t.f(hi)];
    const S = (m * (first + last)) / 2;
    return {
      prompt: md`Evaluate $${sigmaTex(lo, hi, t)}$.`,
      answer: String(S),
      verify: [`x = ${expandText(t, lo, hi)}`],
      hint: md`The terms form an arithmetic sequence. Find how many there are, and the first and last.`,
      solution: [
        { math: md`${hi} - ${lo} + 1 = ${m} \text{ terms}`, note: "Count the index values, fencepost style." },
        { math: md`\text{first } ${first}, \quad \text{last } ${last}`, note: md`Put $k = ${lo}$ and $k = ${hi}$ into $${t.tex}$.` },
        { math: md`S = \frac{${m}(${first} + ${last})}{2} = ${S}`, note: "Number of terms times the average of the first and last." },
      ],
    };
  }
  if (kind === 2 || kind === 3) {
    const base = r.pick([2, 3]);
    const c = r.pick([1, 2, 3, 4, 5]);
    const n = r.int(5, base === 2 ? 9 : 7);
    const zero = kind === 3;
    const t: Term = zero
      ? { tex: `${c === 1 ? "" : `${c} \\cdot `}${base}^{k}`, text: `${c}*${base}^(k)`, f: (k) => c * base ** k, sum: false }
      : { tex: `${c === 1 ? "" : `${c} \\cdot `}${base}^{k-1}`, text: `${c}*${base}^(k-1)`, f: (k) => c * base ** (k - 1), sum: false };
    const [lo, hi] = zero ? [0, n - 1] : [1, n];
    const S = (c * (base ** n - 1)) / (base - 1);
    return {
      prompt: md`Evaluate $${sigmaTex(lo, hi, t)}$.`,
      answer: String(S),
      verify: [`x = ${expandText(t, lo, hi)}`],
      hint: md`The terms are geometric. Write the first term and the ratio, count the terms, and use the finite geometric sum.`,
      solution: [
        { math: md`${c} + ${c * base} + ${c * base * base} + \dots`, note: md`First term ${c} (at $k = ${lo}$), ratio ${base}, and $${hi} - ${lo} + 1 = ${n}$ terms.` },
        { math: md`S = ${c} \cdot \frac{${base}^{${n}} - 1}{${base} - 1} = ${c} \cdot ${base === 2 ? base ** n - 1 : md`\frac{${base ** n - 1}}{${base - 1}}`}`, note: md`$a_1 \cdot \frac{1 - r^n}{1 - r}$, with top and bottom multiplied by $-1$ since $r > 1$.` },
        { math: String(S), note: "" },
      ],
    };
  }
  const n = r.int(20, 60);
  const t = linearTerm(2, -1);
  return {
    prompt: md`Evaluate $${sigmaTex(1, n, t)}$.`,
    answer: String(n * n),
    verify: [`x = ${expandText(t, 1, n)}`],
    hint: md`These are the first ${n} odd numbers. Split the sum, or use the picture of L-shaped layers.`,
    solution: [
      { math: md`2\sum_{k=1}^{${n}} k - \sum_{k=1}^{${n}} 1 = 2 \cdot \frac{${n} \cdot ${n + 1}}{2} - ${n}`, note: "Split the sum, then use Gauss's sum." },
      { math: md`${n * (n + 1)} - ${n} = ${n * n}`, note: md`It is $${n}^2$: the odd numbers always add up to a square.` },
    ],
  };
};

const writeSigma: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const t = linearTerm(r.int(2, 7), r.int(-1, 6));
    const N = r.int(8, 25);
    const last = t.f(N);
    return {
      prompt: md`The sum $${dotsSumTex(ints([t.f(1), t.f(2), t.f(3)]), q(last))}$ is written $${sigmaTex(1, "N", t)}$. Find $N$.`,
      answer: String(N),
      verify: [`${at(t.text, "x")} = ${last}`],
      hint: md`The last term comes from $k = N$. Solve $${t.tex} = ${last}$ for $k$.`,
      solution: [
        { math: md`${t.tex.replace(/k/g, "N")} = ${last}`, note: "The last term is the term at k = N." },
        { math: md`N = ${N}`, note: md`Solve. Check: $k = 1$ gives ${t.f(1)}, the first term.` },
      ],
    };
  }
  if (kind === 1) {
    const lo = r.int(0, 15);
    const hi = lo + r.int(5, 40);
    const t = r.pick<Term>([linearTerm(r.int(2, 5), r.int(-4, 4)), { tex: "k^2", text: "k^2", f: (k) => k * k, sum: false }, { tex: "2^{k}", text: "2^(k)", f: (k) => 2 ** k, sum: false }]);
    return {
      prompt: md`How many terms does $${sigmaTex(lo, hi, t)}$ have?`,
      answer: String(hi - lo + 1),
      verify: [`${lo} + (x - 1) = ${hi}`],
      hint: md`List the index values $${lo}, ${lo + 1}, \dots, ${hi}$. Subtracting counts the gaps between them, not the values.`,
      solution: [
        { math: md`${hi} - ${lo} = ${hi - lo}`, note: md`That counts the steps from ${lo} to ${hi}.` },
        { math: md`${hi - lo} + 1 = ${hi - lo + 1}`, note: "There is one more value than there are steps." },
      ],
    };
  }
  if (kind === 2) {
    const N = r.int(10, 30);
    let [a1, d] = positiveArith(r, N);
    while (Math.abs(d) < 2) [a1, d] = positiveArith(r, N);
    const tk = (k: number) => a1 + (k - 1) * d;
    const answer = poly([[d, "k"], [a1 - d, ""]]);
    return {
      prompt: md`Fill in the box: $${dotsSumTex(ints([tk(1), tk(2), tk(3)]), q(tk(N)))} = \sum_{k=1}^{${N}} \square$. Type the term as an expression in $k$, like 3k + 1.`,
      answer,
      hint: md`The terms are arithmetic. The term at $k$ is $a_1 + (k - 1)d$.`,
      solution: [
        { math: md`a_1 = ${a1}, \quad d = ${d}`, note: "" },
        { math: md`${a1} + (k - 1)(${d}) = ${answer}`, note: md`Check the last term: $k = ${N}$ gives ${tk(N)}.` },
      ],
    };
  }
  const ratio = r.pick<Q>([[2, 1], [3, 1], [1, 2]]);
  const N = r.int(5, ratio[0] === 3 ? 7 : 8);
  const a1 = isInt(ratio) ? q(r.pick([1, 2, 3, 5])) : q(r.pick([1, 3]) * 2 ** (N - 1));
  const terms = geoTerms(a1, ratio, N);
  return {
    prompt: md`Fill in the box: $${dotsSumTex(terms.slice(0, 3), terms[N - 1])} = \sum_{k=1}^{${N}} \square$. Type the term as an expression in $k$, like 7(4)^(k - 1).`,
    answer: `${qText(a1)}(${qText(ratio)})^(k - 1)`,
    hint: md`The terms are geometric. The term at $k$ is $a_1 r^{k-1}$.`,
    solution: [
      { math: md`a_1 = ${qTex(a1)}, \quad r = ${qTex(ratio)}`, note: "" },
      { math: md`${qTex(a1)} \cdot ${powTex(ratio, "k-1")}`, note: md`Check the last term: $k = ${N}$ gives $${qTex(a1)} \cdot ${qParen(qpow(ratio, N - 1))} = ${qTex(terms[N - 1]!)}$.` },
    ],
  };
};

// ── Lesson 4: Infinite geometric series ─────────────────────────────────────

const CONVERGENT: Q[] = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [-1, 2], [-1, 3], [1, 5], [2, 5], [-2, 3], [-1, 4], [3, 5]];
const DIVERGENT: Q[] = [[3, 2], [2, 1], [-2, 1], [4, 3], [-3, 2], [1, 1], [-1, 1], [3, 1]];
const qLess1 = (r: Q) => Math.abs(r[0]) < r[1];

/** S = a1/(1 - r), as steps. */
function infiniteSteps(a1: Q, ratio: Q): { S: Q; steps: Step[] } {
  const bottom = qsub(ONE, ratio);
  const S = qdiv(a1, bottom);
  return {
    S,
    steps: [
      { math: md`|r| = ${qTex(qabs(ratio))} < 1`, note: md`So $r^n$ shrinks toward 0 and the partial sums settle down: the series converges.` },
      { math: md`S = \frac{a_1}{1 - r} = \frac{${qTex(a1)}}{1 - ${qParen(ratio)}} = \frac{${qTex(a1)}}{${qTex(bottom)}}`, note: "" },
      { math: md`S = ${qTex(S)}`, note: isInt(bottom) ? "" : md`Dividing by $${qTex(bottom)}$ is multiplying by $${qTex(qdiv(ONE, bottom))}$.` },
    ],
  };
}

const infiniteSeries: Generator = (r) => {
  const converge = r.next() < 0.72;
  const ratio = r.pick(converge ? CONVERGENT : DIVERGENT);
  // 0: a + ar + ar^2 + ..., 1: sum a r^(k-1) from 1, 2: sum a r^k from 1, 3: sum a r^k from 0
  const form = Math.abs(ratio[0]) === ratio[1] ? 0 : r.int(0, 3);
  // Whole numbers in the first three listed terms; a sigma only needs a friendly coefficient.
  const m = r.pick([1, 2, 3, 4, 5]);
  const a = form === 0 ? q(m * ratio[1] ** 2 * (r.next() < 0.15 ? -1 : 1)) : q(m * ratio[1]);
  // A bare whole-number base needs a dot, or 4 3^{k-1} renders as 43^{k-1}.
  const coef = a[0] === 1 && a[1] === 1 ? "" : isInt(ratio) && ratio[0] > 0 ? md`${qTex(a)} \cdot ` : `${qTex(a)} `;
  const a1 = form === 2 ? qmul(a, ratio) : a;
  const shown =
    form === 0
      ? dotsSumTex(geoTerms(a, ratio, 3))
      : form === 1
        ? md`\sum_{k=1}^{\infty} ${coef}${powTex(ratio, "k-1")}`
        : form === 2
          ? md`\sum_{k=1}^{\infty} ${coef}${powTex(ratio, "k")}`
          : md`\sum_{k=0}^{\infty} ${coef}${powTex(ratio, "k")}`;
  const read: Step = {
    math: md`a_1 = ${qTex(a1)}, \quad r = ${qTex(ratio)}`,
    note:
      form === 0
        ? "The first term, and the second term divided by the first."
        : form === 2
          ? md`The first term is at $k = 1$, so it is $${qTex(a)} \cdot ${qParen(ratio)}^1 = ${qTex(a1)}$, not ${qTex(a)}. Each term is $r$ times the last.`
          : md`At the first index the power is $${qParen(ratio)}^0 = 1$, so the first term is ${qTex(a)}. Each term is $r$ times the last.`,
  };
  const prompt = md`Find the sum of the infinite series $${shown}$. ${EXACT} If the series has no sum, type **diverges**.`;
  if (!converge) {
    return {
      prompt,
      accept: DIVERGES,
      hint: md`Find the common ratio $r$. An infinite geometric series has a sum only when $|r| < 1$.`,
      solution: [
        read,
        { math: md`|r| = ${qTex(qabs(ratio))} \ge 1`, note: ratio[0] === ratio[1] ? "Every term is the same, so the partial sums grow in size without end." : ratio[0] === -ratio[1] ? "The partial sums bounce between two values forever." : "The terms grow in size, so the partial sums never settle near one number." },
        { math: md`\text{diverges}`, note: "There is no sum." },
      ],
    };
  }
  const { S, steps } = infiniteSteps(a1, ratio);
  return {
    prompt,
    answer: qText(S),
    verify: [`x = (${qText(a1)}) + (${qText(ratio)})x`],
    hint: md`Find the first term $a_1$ and the ratio $r$. If $|r| < 1$, the sum is $\frac{a_1}{1 - r}$.`,
    solution: [read, ...steps],
  };
};

const repeatingAndUnknowns: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const d = r.int(1, 8);
    return {
      prompt: md`Write $0.\overline{${d}}$ as a fraction in lowest terms.`,
      answer: frac(d, 9),
      simplified: true,
      verify: [`10x = ${d} + x`],
      hint: md`$0.\overline{${d}} = \frac{${d}}{10} + \frac{${d}}{100} + \frac{${d}}{1000} + \dots$, a geometric series.`,
      solution: [
        { math: md`a_1 = \frac{${d}}{10}, \quad r = \frac{1}{10}`, note: "Each digit is worth a tenth of the one before." },
        { math: md`S = \frac{${d}/10}{1 - 1/10} = \frac{${d}/10}{9/10} = \frac{${d}}{9}`, note: "" },
        { math: fracTex(d, 9), note: gcd(d, 9) > 1 ? "Reduce." : "" },
      ],
    };
  }
  if (kind === 1) {
    let ab = r.int(10, 98);
    while (ab % 11 === 0) ab = r.int(10, 98);
    const ans = frac(ab, 99);
    return {
      prompt: md`Write $0.\overline{${ab}}$ as a fraction in lowest terms.`,
      answer: ans,
      simplified: true,
      verify: [`100x = ${ab} + x`],
      hint: md`$0.\overline{${ab}} = \frac{${ab}}{100} + \frac{${ab}}{10000} + \dots$. What is the ratio?`,
      solution: [
        { math: md`a_1 = \frac{${ab}}{100}, \quad r = \frac{1}{100}`, note: "The block of two digits repeats, each copy worth a hundredth of the one before." },
        { math: md`S = \frac{${ab}/100}{99/100} = \frac{${ab}}{99}`, note: "" },
        { math: fracTex(ab, 99), note: gcd(ab, 99) > 1 ? md`Reduce: both divide by ${gcd(ab, 99)}.` : "Nothing divides both, so this is in lowest terms." },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(1, 9);
    let b = r.int(1, 9);
    while (b === a) b = r.int(1, 9);
    return {
      prompt: md`Write $0.${a}\overline{${b}}$ as a fraction in lowest terms.`,
      answer: frac(9 * a + b, 90),
      simplified: true,
      verify: [`100x - 10x = ${10 * a + b} - ${a}`],
      hint: md`Split it: $0.${a}\overline{${b}} = \frac{${a}}{10} + 0.0\overline{${b}}$, and the repeating part is a geometric series.`,
      solution: [
        { math: md`0.0\overline{${b}} = \frac{${b}/100}{1 - 1/10} = \frac{${b}}{90}`, note: md`First term $\frac{${b}}{100}$, ratio $\frac{1}{10}$.` },
        { math: md`\frac{${a}}{10} + \frac{${b}}{90} = \frac{${9 * a}}{90} + \frac{${b}}{90} = \frac{${9 * a + b}}{90}`, note: "Common denominator 90." },
        { math: fracTex(9 * a + b, 90), note: gcd(9 * a + b, 90) > 1 ? "Reduce." : "Already in lowest terms." },
      ],
    };
  }
  const ratio = r.pick(CONVERGENT);
  const a1 = q(r.int(1, 9) * ratio[1] * (r.next() < 0.2 ? -1 : 1));
  const bottom = qsub(ONE, ratio);
  const S = qdiv(a1, bottom);
  if (kind === 3) {
    return {
      prompt: md`An infinite geometric series has common ratio $${qTex(ratio)}$ and sum $${qTex(S)}$. Find its first term. ${EXACT}`,
      answer: qText(a1),
      verify: [`x/(1 - (${qText(ratio)})) = ${qText(S)}`],
      hint: md`Put what you know into $S = \frac{a_1}{1 - r}$ and solve for $a_1$.`,
      solution: [
        { math: md`${qTex(S)} = \frac{a_1}{1 - ${qParen(ratio)}} = \frac{a_1}{${qTex(bottom)}}`, note: "" },
        { math: md`a_1 = ${qTex(S)} \cdot ${qParen(bottom)} = ${qTex(a1)}`, note: md`Multiply both sides by $${qTex(bottom)}$.` },
      ],
    };
  }
  return {
    prompt: md`An infinite geometric series has first term $${qTex(a1)}$ and sum $${qTex(S)}$. Find its common ratio $r$. ${EXACT}`,
    answer: qText(ratio),
    verify: [`(${qText(a1)})/(1 - x) = ${qText(S)}`],
    hint: md`Put what you know into $S = \frac{a_1}{1 - r}$. Solve for $1 - r$ first.`,
    solution: [
      { math: md`${qTex(S)} = \frac{${qTex(a1)}}{1 - r}`, note: "" },
      { math: md`1 - r = \frac{${qTex(a1)}}{${qTex(S)}} = ${qTex(bottom)}`, note: "Swap the sum and 1 - r: multiply by 1 - r, then divide by the sum." },
      { math: md`r = 1 - ${qParen(bottom)} = ${qTex(ratio)}`, note: md`Check: $|r| < 1$, so the series really does converge.` },
    ],
  };
};

const seriesApplications: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const H = r.pick([4, 6, 8, 10, 12, 16, 20, 24]);
    const p = r.pick<Q>([[1, 2], [1, 3], [2, 3], [3, 4], [1, 4], [3, 5], [2, 5]]);
    const up = qmul(q(H), p);
    const rest = qdiv(qmul(q(2), up), qsub(ONE, p));
    const total = qadd(q(H), rest);
    return {
      prompt: md`A ball is dropped from a height of ${H} feet. Each time it lands it bounces back up to $${qTex(p)}$ of the height it just fell. Find the total distance it travels, up and down, before it comes to rest. ${EXACT}`,
      answer: qText(total),
      verify: [`x = ${H} + (${qText(p)})(${H}) + (${qText(p)})x`],
      hint: md`After the first fall of ${H} feet, every bounce goes up and comes back down the same distance. The bounce heights form a geometric series.`,
      solution: [
        { math: md`\text{bounce heights: } ${qTex(up)}, \ ${qTex(qmul(up, p))}, \ \dots`, note: md`Each is $${qTex(p)}$ of the one before.` },
        { math: md`\text{up} = \frac{${qTex(up)}}{1 - ${qTex(p)}} = ${qTex(qdiv(up, qsub(ONE, p)))}`, note: md`An infinite geometric series with ratio $${qTex(p)} < 1$.` },
        { math: md`${H} + 2 \cdot ${qParen(qdiv(up, qsub(ONE, p)))} = ${qTex(total)}`, note: "The first drop, plus every rise counted twice (once up, once down)." },
      ],
    };
  }
  if (kind === 1) {
    const D = r.pick([50, 100, 200, 300, 400]);
    const f = r.pick<Q>([[1, 2], [1, 4], [1, 5], [2, 5], [1, 3], [3, 10]]);
    const S = qdiv(q(D), qsub(ONE, f));
    return {
      prompt: md`A patient takes ${D} mg of a medicine every morning. By the next morning, $${qTex(f)}$ of the amount in the body is still there. Over time, the amount right after a morning dose levels off. What amount does it approach, in milligrams? ${EXACT}`,
      answer: qText(S),
      verify: [`x = ${D} + (${qText(f)})x`],
      hint: md`Right after a dose the body holds today's ${D} mg, plus what is left of yesterday's, plus what is left of the day before's, and so on.`,
      solution: [
        { math: md`${D} + ${D} \cdot ${qTex(f)} + ${D} \cdot ${powTex(f, 2)} + \dots`, note: "Today's dose, then each earlier dose shrunk once per day since." },
        { math: md`S = \frac{${D}}{1 - ${qTex(f)}} = \frac{${D}}{${qTex(qsub(ONE, f))}}`, note: md`Geometric with ratio $${qTex(f)} < 1$. The amount after each dose is a partial sum, and the partial sums approach this.` },
        { math: md`S = ${qTex(S)}`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const s = r.pick([2, 4, 6, 8, 10, 12]);
    return {
      prompt: md`A square has side ${s}. Joining the midpoints of its sides makes a smaller square inside it. Do the same to that square, and keep going forever. Find the total area of all the squares.`,
      figure: nestedSquares(s),
      answer: String(2 * s * s),
      verify: [`x = ${s * s} + (1/2)x`],
      hint: md`Each new square has half the area of the one around it. Cut the outer square along the inner square's sides to see why.`,
      solution: [
        { math: md`${s * s} + ${s * s / 2} + ${frac(s * s, 4)} + \dots`, note: md`The inner square cuts off four corner triangles that together have the same area as itself, so it is half the outer square.` },
        { math: md`S = \frac{${s * s}}{1 - \frac{1}{2}} = ${2 * s * s}`, note: md`Geometric with $a_1 = ${s * s}$ and $r = \frac{1}{2}$.` },
      ],
    };
  }
  const ratio = r.pick<Q>([[1, 2], [2, 3], [-1, 2], [3, 4], [-2, 3], [1, 3]]);
  const a1 = q(r.pick([2, 3, 4, 6]) * ratio[1]);
  const partial: number[] = [];
  let run = 0;
  for (let k = 0; k < 10; k++) partial.push((run += (a1[0] * ratio[0] ** k) / ratio[1] ** k));
  const lo = Math.min(0, ...partial);
  const hi = Math.max(...partial);
  const { S, steps } = infiniteSteps(a1, ratio);
  return {
    prompt: md`The graph shows the partial sums $S_1, S_2, \dots, S_{10}$ of the series $${dotsSumTex(geoTerms(a1, ratio, 3))}$. Find the number they approach. ${EXACT}`,
    figure: {
      kind: "plot",
      x: [0, 11],
      y: [Math.floor(lo - 1), Math.ceil(hi + 1)],
      points: partial.map((v, i) => ({ x: i + 1, y: v })),
    },
    answer: qText(S),
    verify: [`x = (${qText(a1)}) + (${qText(ratio)})x`],
    hint: md`The points level off at the sum of the infinite series, $\frac{a_1}{1 - r}$.`,
    solution: [{ math: md`a_1 = ${qTex(a1)}, \quad r = ${qTex(ratio)}`, note: "The first term, and the second divided by the first." }, ...steps],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit7: Unit = {
  title: "Sequences and Series",
  lessons: [
    {
      id: "arithmetic-sequences",
      title: "Arithmetic sequences",
      summary: "Sequences that add the same amount each step: recursive and explicit formulas, and adding the terms by pairing.",
      blocks: [
        {
          kind: "text",
          body: md`A **sequence** is a list of numbers in order, like $5, 8, 11, 14, \dots$. Each number is a **term**. We name the terms with one letter and a position: $a_1$ is the first term, $a_2$ the second, and $a_n$ the term in position $n$. The small number is an *index*, a label for the position. It is not an exponent and not a multiplier.

You have met this idea before. A sequence is a function whose inputs are the positions $1, 2, 3, \dots$. Writing $a_n$ is a compact way to write $a(n)$.`,
        },
        {
          kind: "key",
          title: "Arithmetic sequence",
          body: md`A sequence is **arithmetic** when you add the same number every time to get the next term. That number is the **common difference** $d$:
$$a_n = a_{n-1} + d \quad\text{for } n \ge 2.$$
To find $d$, subtract any term from the one after it. For $5, 8, 11, 14, \dots$ the difference is $d = 3$. For $20, 14, 8, \dots$ it is $d = -6$.`,
        },
        {
          kind: "text",
          body: md`There are two ways to describe a sequence. A **recursive** formula tells you how to get each term from the one before: start with $a_1 = 5$, then $a_n = a_{n-1} + 3$. An **explicit** formula gives term $n$ straight from $n$.

Recursive formulas are natural, but slow. To find $a_{100}$ recursively you would first need all 99 terms before it. An explicit formula jumps straight there.`,
        },
        {
          kind: "why",
          title: "Where the explicit formula comes from",
          body: md`Count the steps. To get from $a_1$ to $a_2$ you add $d$ once. To reach $a_3$ you add it twice. To reach $a_n$ you add it $n - 1$ times, one fewer than the position, because the first term needs no steps at all:
$$a_n = a_1 + (n - 1)d.$$
It is the fencepost count: a fence with $n$ posts has $n - 1$ gaps between them.`,
        },
        {
          kind: "key",
          title: "Explicit formula",
          body: md`$$a_n = a_1 + (n - 1)d$$
For $5, 8, 11, \dots$: $a_n = 5 + (n - 1) \cdot 3 = 3n + 2$. Check it on a term you know: $a_1 = 3 + 2 = 5$, and $a_3 = 9 + 2 = 11$.`,
        },
        {
          kind: "plot",
          x: [0, 7],
          y: [-12, 12],
          curves: [{ expr: "a + (x - 1)d", color: 3, dashed: true, domain: [1, 6] }],
          points: range(1, 6).map((n) => ({
            x: n,
            y: `a + (${n} - 1)d`,
            ...(n === 1 ? { label: "a_1 = {a}" } : n === 6 ? { label: "a_6 = {=a + 5d}" } : {}),
          })),
          params: [
            { name: "a", tex: "a_1", min: -4, max: 4, step: 1, value: -3 },
            { name: "d", min: -1.5, max: 1.5, step: 0.5, value: 1.5 },
          ],
          caption: md`Each term is a point $(n, a_n)$. Slide $d$: the points always sit on a line, and its slope is $d$. Slide $a_1$: the whole set moves up or down.`,
        },
        {
          kind: "why",
          title: "Why the points lie on a line",
          body: md`Distribute the explicit formula: $a_n = a_1 + (n - 1)d = dn + (a_1 - d)$. That is a linear function of $n$, the familiar $y = mx + b$ with slope $m = d$.

So an arithmetic sequence is a linear function looked at only at whole-number inputs. That is why the common difference behaves exactly like a slope: it is the change in output for each step of 1 in the input.`,
        },
        {
          kind: "example",
          title: "A formula and a far term",
          problem: md`Find an explicit formula for $7, 11, 15, 19, \dots$ and use it to find $a_{30}$.`,
          steps: [
            { math: md`d = 11 - 7 = 4`, note: "Subtract a term from the one after it." },
            { math: md`a_n = 7 + (n - 1) \cdot 4 = 4n + 3`, note: "Start at the first term and take n - 1 steps of 4." },
            { math: md`a_{30} = 4(30) + 3 = 123`, note: "No need to list 30 terms." },
          ],
        },
        {
          kind: "example",
          title: "Two terms are enough",
          problem: md`An arithmetic sequence has $a_5 = 17$ and $a_{12} = 45$. Find $d$ and $a_1$.`,
          steps: [
            { math: md`7d = 45 - 17 = 28`, note: "From position 5 to position 12 is 7 steps of d." },
            { math: md`d = 4`, note: "" },
            { math: md`a_1 = a_5 - 4d = 17 - 16 = 1`, note: "Term 5 is 4 steps after term 1, so walk back 4 steps." },
            { math: md`a_{12} = 1 + 11 \cdot 4 = 45`, note: "Check against the other given term." },
          ],
        },
        {
          kind: "check",
          prompt: md`Write an explicit formula for $2, 9, 16, 23, \dots$. Type only the expression in $n$ (leave off $a_n =$).`,
          answer: "7n - 5",
          explain: md`$d = 7$ and $a_1 = 2$, so $a_n = 2 + (n - 1) \cdot 7 = 7n - 5$. Check: $n = 1$ gives 2.`,
        },
        {
          kind: "text",
          body: md`**Adding up the terms.** The sum of the terms of a sequence is called a **series**. We write $S_n$ for the sum of the first $n$ terms.

There is a story that the young Carl Friedrich Gauss was told to add $1 + 2 + 3 + \dots + 100$ and had the answer in moments. His idea works for every arithmetic sequence.`,
        },
        { kind: "diagram", ...staircase(5) },
        {
          kind: "why",
          title: "Gauss's pairing",
          body: md`Write the sum twice, once forwards and once backwards, and add the two lines column by column:
$$\begin{aligned} S &= 1 + 2 + \dots + 99 + 100 \\ S &= 100 + 99 + \dots + 2 + 1 \\ 2S &= 101 + 101 + \dots + 101 + 101 \end{aligned}$$
Every column adds to 101. Moving one column to the right, the top number goes up by 1 and the bottom number goes down by 1, so the total never changes. There are 100 columns, so $2S = 100 \cdot 101$ and $S = 5050$. The staircase picture is the same argument: two copies of the sum make a rectangle.`,
        },
        {
          kind: "proof",
          title: "The sum of an arithmetic series",
          given: md`An arithmetic sequence $a_1, a_2, \dots, a_n$ with common difference $d$`,
          prove: md`$S_n = a_1 + a_2 + \dots + a_n = \dfrac{n(a_1 + a_n)}{2}$`,
          steps: [
            { statement: md`$S_n = a_1 + (a_1 + d) + \dots + (a_n - d) + a_n$`, reason: "Each term is d more than the one before, and d less than the one after" },
            { statement: md`$S_n = a_n + (a_n - d) + \dots + (a_1 + d) + a_1$`, reason: "The same terms in reverse order (commutative property)" },
            { statement: md`Each column adds to $a_1 + a_n$`, reason: md`Column $k$ holds $a_1 + (k - 1)d$ and $a_n - (k - 1)d$: the $d$'s cancel` },
            { statement: md`$2S_n = n(a_1 + a_n)$`, reason: md`Add the two lines: there are $n$ columns` },
            { statement: md`$S_n = \dfrac{n(a_1 + a_n)}{2}$`, reason: "Divide both sides by 2" },
          ],
        },
        {
          kind: "key",
          title: "Arithmetic series",
          body: md`$$S_n = \frac{n(a_1 + a_n)}{2} = \frac{n}{2}\big(2a_1 + (n - 1)d\big)$$
In words: the number of terms times the average of the first and last terms. The second form substitutes $a_n = a_1 + (n - 1)d$, for when you don't know the last term.`,
        },
        {
          kind: "example",
          title: "When the last term is given",
          problem: md`Find $3 + 7 + 11 + \dots + 99$.`,
          steps: [
            { math: md`d = 4`, note: "" },
            { math: md`3 + (n - 1) \cdot 4 = 99 \implies n - 1 = 24, \quad n = 25`, note: "Count the terms first. The last term tells you how many there are." },
            { math: md`S_{25} = \frac{25(3 + 99)}{2} = 25 \cdot 51 = 1275`, note: "Number of terms times the average of the ends." },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $1 + 2 + 3 + \dots + 200$.`,
          answer: "20100",
          explain: md`200 terms, first 1, last 200: $\frac{200 \cdot 201}{2} = 20100$.`,
        },
      ],
      practice: [arithmeticTerm, arithmeticFormula, arithmeticSum],
    },
    {
      id: "geometric-sequences",
      title: "Geometric sequences",
      summary: "Sequences that multiply by the same ratio each step, and how subtracting rS from S adds them up.",
      blocks: [
        {
          kind: "text",
          body: md`Fold a sheet of paper in half and it is 2 layers thick. Fold again: 4 layers. Then 8, 16, 32. Each term isn't a fixed amount *more* than the last. It is a fixed *multiple* of it. Arithmetic sequences add; these multiply.`,
        },
        {
          kind: "key",
          title: "Geometric sequence",
          body: md`A sequence is **geometric** when its first term is nonzero and you multiply by the same nonzero number every time to get the next term. Then no term is ever 0. That number is the **common ratio** $r$:
$$a_n = r \cdot a_{n-1} \quad\text{for } n \ge 2.$$
To find $r$, divide any term by the one before it. For $3, 6, 12, 24, \dots$ the ratio is $r = 2$. For $80, 20, 5, \dots$ it is $r = \frac{1}{4}$. For $2, -6, 18, \dots$ it is $r = -3$, and the signs alternate.`,
        },
        {
          kind: "why",
          title: "The explicit formula",
          body: md`Count the multiplications. $a_2 = a_1 r$, then $a_3 = a_1 r \cdot r = a_1 r^2$, then $a_4 = a_1 r^3$. Reaching position $n$ takes $n - 1$ multiplications by $r$, the same fencepost count as before. Repeated multiplication is a power, so
$$a_n = a_1 r^{n-1}.$$`,
        },
        {
          kind: "key",
          title: "Explicit formula",
          body: md`$$a_n = a_1 \cdot r^{n-1}$$
For $3, 6, 12, \dots$: $a_n = 3 \cdot 2^{n-1}$, so $a_{10} = 3 \cdot 2^9 = 1536$.`,
        },
        {
          kind: "plot",
          x: [0, 7],
          y: [-16, 16],
          curves: [{ expr: "a r^(x - 1)", color: 3, dashed: true, domain: [1, 6] }],
          points: range(1, 6).map((n) => ({ x: n, y: `a r^(${n} - 1)`, ...(n === 6 ? { label: "a_6 = {=a r^5}" } : {}) })),
          params: [
            { name: "a", tex: "a_1", min: 1, max: 2, step: 1, value: 1 },
            { name: "r", min: -1.5, max: 1.5, step: 0.25, value: 1.5 },
          ],
          caption: md`Slide $r$. For $r > 1$ the points climb faster and faster. For $0 < r < 1$ they shrink toward 0. For $r < 0$ they jump across the axis at every step. The dashed curve is the exponential function $y = a_1 r^{x-1}$, drawn when $r > 0$.`,
        },
        {
          kind: "why",
          title: "Geometric means exponential",
          body: md`Rewrite the formula: $a_n = a_1 r^{n-1} = \frac{a_1}{r} \cdot r^n$. When $r > 0$ and $r \ne 1$, that is an exponential function $y = a \cdot b^x$ (Unit 6) with base $b = r$, looked at only at whole numbers. A negative ratio is fine for a sequence, since whole-number powers of a negative number make sense, but no exponential curve passes through its points: they jump across the axis.

So the two kinds of sequence are the two kinds of function you know best. Arithmetic sequences are linear: each step *adds* a constant. Geometric sequences with a positive ratio are exponential: each step *multiplies* by a constant.`,
        },
        {
          kind: "text",
          body: md`**Arithmetic, geometric, or neither?** Work out the differences between neighbouring terms, and the ratios. If the differences are all equal, it is arithmetic. If the ratios are all equal, it is geometric. Many sequences are neither: for $1, 4, 9, 16, \dots$ the differences are $3, 5, 7$ and the ratios are $4, \frac{9}{4}, \frac{16}{9}$.`,
        },
        {
          kind: "example",
          title: "A negative fraction ratio",
          problem: md`Find $a_7$ for $48, -24, 12, -6, \dots$.`,
          steps: [
            { math: md`r = \frac{-24}{48} = -\frac{1}{2}`, note: "Divide a term by the one before it." },
            { math: md`a_7 = 48 \cdot \left(-\frac{1}{2}\right)^{6}`, note: "Six multiplications by r after the first term." },
            { math: md`a_7 = 48 \cdot \frac{1}{64} = \frac{3}{4}`, note: "An even power of a negative number is positive." },
          ],
        },
        {
          kind: "example",
          title: "Two terms are enough",
          problem: md`A geometric sequence has $a_2 = 12$ and $a_5 = 324$. Find $r$ and $a_1$.`,
          steps: [
            { math: md`a_5 = a_2 \cdot r^3`, note: "From term 2 to term 5 is three multiplications by r." },
            { math: md`r^3 = \frac{324}{12} = 27, \quad r = 3`, note: "Only one real number cubes to 27." },
            { math: md`a_1 = \frac{a_2}{r} = \frac{12}{3} = 4`, note: "Step back one term by dividing by r." },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $a_6$ for $2, 6, 18, 54, \dots$.`,
          answer: "486",
          explain: md`$r = 3$, so $a_6 = 2 \cdot 3^5 = 2 \cdot 243 = 486$.`,
        },
        {
          kind: "text",
          body: md`**Adding a geometric sequence.** Put 1 grain of rice on the first square of a chessboard, 2 on the second, 4 on the third, doubling each time. How much rice is on the board? That is $1 + 2 + 4 + \dots + 2^{63}$.

Gauss's pairing doesn't help here: the terms aren't evenly spaced, so first plus last isn't the same as second plus second-to-last. A different trick works. Slide the sum against a copy of itself.`,
        },
        {
          kind: "why",
          title: "Shift and subtract",
          body: md`Take $S = 1 + 2 + 4 + 8 + 16$. Multiply by the ratio 2:
$$\begin{aligned} 2S &= \phantom{1 + {}} 2 + 4 + 8 + 16 + 32 \\ S &= 1 + 2 + 4 + 8 + 16 \end{aligned}$$
The two lines share every term except the ends. Subtract, and the middle cancels: $2S - S = 32 - 1$, so $S = 31$.

Multiplying by $r$ moves every term one place along. Subtracting then leaves only the first term and the one just past the last.`,
        },
        {
          kind: "proof",
          title: "The sum of a finite geometric series",
          given: md`A geometric sequence with first term $a_1$ and ratio $r \ne 1$`,
          prove: md`$S_n = a_1 + a_1 r + \dots + a_1 r^{n-1} = a_1 \cdot \dfrac{1 - r^n}{1 - r}$`,
          steps: [
            { statement: md`$S_n = a_1 + a_1 r + a_1 r^2 + \dots + a_1 r^{n-1}$`, reason: md`Definition of $S_n$, using $a_k = a_1 r^{k-1}$` },
            { statement: md`$rS_n = a_1 r + a_1 r^2 + \dots + a_1 r^{n-1} + a_1 r^n$`, reason: md`Multiply every term by $r$ (distributive property)` },
            { statement: md`$S_n - rS_n = a_1 - a_1 r^n$`, reason: md`Subtract: $a_1 r$ through $a_1 r^{n-1}$ appear in both lines and cancel` },
            { statement: md`$S_n(1 - r) = a_1(1 - r^n)$`, reason: "Factor both sides" },
            { statement: md`$S_n = a_1 \cdot \dfrac{1 - r^n}{1 - r}$`, reason: md`Divide by $1 - r$, which is not 0 because $r \ne 1$` },
          ],
        },
        {
          kind: "key",
          title: "Finite geometric series",
          body: md`$$S_n = a_1 \cdot \frac{1 - r^n}{1 - r} \quad (r \ne 1)$$
Here $n$ is the number of terms. When $r > 1$ it is tidier to multiply top and bottom by $-1$: $S_n = a_1 \cdot \frac{r^n - 1}{r - 1}$. When $r = 1$ every term is $a_1$, so $S_n = n a_1$.`,
        },
        {
          kind: "example",
          title: "The chessboard",
          problem: md`Find $1 + 2 + 4 + \dots + 2^{63}$.`,
          steps: [
            { math: md`a_1 = 1, \quad r = 2, \quad n = 64`, note: md`Square $k$ holds $2^{k-1}$ grains, so the exponents run from 0 to 63: 64 terms.` },
            { math: md`S_{64} = 1 \cdot \frac{2^{64} - 1}{2 - 1} = 2^{64} - 1`, note: "" },
            { math: md`2^{64} - 1 \approx 1.8 \times 10^{19}`, note: "About 18 billion billion grains: hundreds of billions of tonnes of rice." },
          ],
        },
        {
          kind: "example",
          title: "A ratio less than 1",
          problem: md`Find $96 + 48 + 24 + \dots + 3$.`,
          steps: [
            { math: md`r = \frac{48}{96} = \frac{1}{2}`, note: "" },
            { math: md`96 \left(\frac{1}{2}\right)^{n-1} = 3 \implies \left(\frac{1}{2}\right)^{n-1} = \frac{1}{32}, \quad n = 6`, note: md`Count the terms: $\frac{1}{32} = \left(\frac{1}{2}\right)^5$, so $n - 1 = 5$.` },
            { math: md`S_6 = 96 \cdot \frac{1 - (1/2)^6}{1 - 1/2} = 96 \cdot \frac{63/64}{1/2} = 189`, note: md`Check by adding: $96 + 48 + 24 + 12 + 6 + 3 = 189$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $1 + 3 + 9 + \dots + 729$.`,
          answer: "1093",
          explain: md`$729 = 3^6$, so there are 7 terms. $S_7 = \frac{3^7 - 1}{3 - 1} = \frac{2186}{2} = 1093$.`,
        },
      ],
      practice: [geometricTerm, geometricFormula, geometricSum],
    },
    {
      id: "sigma-notation",
      title: "Sigma notation",
      summary: "A compact way to write sums, the rules for working with it, and the sum formulas in its language.",
      blocks: [
        {
          kind: "text",
          body: md`Writing $3 + 7 + 11 + \dots + 99$ works, but the dots ask the reader to guess the pattern. **Sigma notation** states the pattern exactly. The symbol $\Sigma$ is the capital Greek letter S, for *sum*.`,
        },
        {
          kind: "key",
          title: "Reading sigma notation",
          body: md`$$\sum_{k=1}^{5} (2k + 1)$$
says: let the **index** $k$ run through the whole numbers from the **lower limit** 1 to the **upper limit** 5. Work out $2k + 1$ for each one, and add the results:
$$3 + 5 + 7 + 9 + 11 = 35.$$
The letter is only a placeholder: $\sum_{j=1}^{5} (2j + 1)$ is the same sum. A sum from $k = p$ to $k = q$ has $q - p + 1$ terms.

A factor of $(-1)^k$ makes the signs alternate: it is $-1$ when $k$ is odd and $1$ when $k$ is even. So $\sum_{k=1}^{4} (-1)^{k} k = -1 + 2 - 3 + 4 = 2$. With $(-1)^{k+1}$ the signs start with $+$ instead.`,
        },
        {
          kind: "why",
          title: "Why upper minus lower plus one",
          body: md`From 3 to 10 there are $10 - 3 = 7$ *steps*, but 8 numbers: $3, 4, 5, 6, 7, 8, 9, 10$. Subtracting counts the gaps between the numbers, and there is always one more number than gaps. It is the fencepost count again.`,
        },
        {
          kind: "example",
          title: "Expanding a sum",
          problem: md`Evaluate $\sum_{k=2}^{5} k^2$.`,
          steps: [
            { math: md`2^2 + 3^2 + 4^2 + 5^2`, note: md`$k$ runs over 2, 3, 4, 5: that is $5 - 2 + 1 = 4$ terms.` },
            { math: md`4 + 9 + 16 + 25 = 54`, note: "" },
          ],
        },
        {
          kind: "text",
          body: md`**Rules for sums.** Sigma notation would be only a shorthand if you couldn't calculate with it. You can, and the rules are the old properties of addition and multiplication, used many times at once.`,
        },
        {
          kind: "key",
          title: "Properties of sums",
          body: md`- $\sum_{k=1}^{n} c = nc$ for a constant $c$.
- $\sum_{k=1}^{n} c\,a_k = c \sum_{k=1}^{n} a_k$.
- $\sum_{k=1}^{n} (a_k + b_k) = \sum_{k=1}^{n} a_k + \sum_{k=1}^{n} b_k$.`,
        },
        {
          kind: "why",
          title: "Why the rules hold",
          body: md`Write each sum out. A constant summed $n$ times is $c + c + \dots + c$, which is $n$ copies of $c$, or $nc$.

$\sum c\,a_k = c a_1 + c a_2 + \dots + c a_n = c(a_1 + a_2 + \dots + a_n)$ by the distributive property.

$\sum (a_k + b_k) = (a_1 + b_1) + (a_2 + b_2) + \dots + (a_n + b_n)$. The commutative and associative properties let you regroup that as $(a_1 + \dots + a_n) + (b_1 + \dots + b_n)$.

Nothing new is assumed. The notation just records long chains of familiar steps.`,
        },
        {
          kind: "key",
          title: "Two sums to know",
          body: md`$$\sum_{k=1}^{n} k = \frac{n(n + 1)}{2} \qquad \sum_{k=1}^{n} a_1 r^{k-1} = a_1 \cdot \frac{1 - r^n}{1 - r} \ (r \ne 1)$$
The first is Gauss's sum from Lesson 1: $n$ terms, first 1, last $n$. The second is the finite geometric series from Lesson 2.`,
        },
        {
          kind: "example",
          title: "Splitting a sum",
          problem: md`Evaluate $\sum_{k=1}^{20} (4k + 3)$.`,
          steps: [
            { math: md`4\sum_{k=1}^{20} k + \sum_{k=1}^{20} 3`, note: "Split the sum, and pull the 4 out of the first part." },
            { math: md`4 \cdot \frac{20 \cdot 21}{2} + 20 \cdot 3 = 840 + 60 = 900`, note: "Gauss's sum, then 20 copies of 3." },
            { math: md`\frac{20(7 + 83)}{2} = 900`, note: "Check as an arithmetic series: first term 7, last term 83." },
          ],
        },
        { kind: "diagram", ...oddSquares(5) },
        {
          kind: "proof",
          title: "The odd numbers add up to squares",
          given: md`A whole number $n \ge 1$`,
          prove: md`$1 + 3 + 5 + \dots + (2n - 1) = \sum_{k=1}^{n} (2k - 1) = n^2$`,
          steps: [
            { statement: md`$\sum_{k=1}^{n} (2k - 1) = 2\sum_{k=1}^{n} k - \sum_{k=1}^{n} 1$`, reason: "Split the sum and pull out the constant factor" },
            { statement: md`$= 2 \cdot \dfrac{n(n + 1)}{2} - n$`, reason: md`Gauss's sum, and $n$ copies of 1` },
            { statement: md`$= n^2 + n - n$`, reason: "Cancel the 2s and distribute" },
            { statement: md`$= n^2$`, reason: "Combine like terms" },
          ],
        },
        {
          kind: "text",
          body: md`**Writing a sum in sigma notation.** Find a formula for the term at position $k$, then read off the limits. For $3 + 7 + 11 + \dots + 99$ the terms are arithmetic with $d = 4$, so the $k$th term is $3 + (k - 1) \cdot 4 = 4k - 1$. The last term 99 is $4k - 1$ when $k = 25$. So
$$3 + 7 + 11 + \dots + 99 = \sum_{k=1}^{25} (4k - 1).$$
Starting the index somewhere else gives other correct answers, like $\sum_{k=0}^{24} (4k + 3)$. Shifting the index by one means shifting the formula to match.`,
        },
        {
          kind: "example",
          title: "A geometric sum",
          problem: md`Write $5 + 10 + 20 + \dots + 640$ in sigma notation and evaluate it.`,
          steps: [
            { math: md`a_k = 5 \cdot 2^{k-1}`, note: md`Geometric with first term 5 and ratio 2.` },
            { math: md`5 \cdot 2^{k-1} = 640 \implies 2^{k-1} = 128 = 2^7, \quad k = 8`, note: "Find which k gives the last term." },
            { math: md`\sum_{k=1}^{8} 5 \cdot 2^{k-1} = 5 \cdot \frac{2^8 - 1}{2 - 1} = 5 \cdot 255 = 1275`, note: "" },
          ],
        },
        {
          kind: "check",
          prompt: md`Evaluate $\sum_{k=1}^{4} k^2$.`,
          answer: "30",
          explain: md`$1 + 4 + 9 + 16 = 30$.`,
        },
        {
          kind: "check",
          prompt: md`Evaluate $\sum_{k=1}^{50} (2k + 1)$.`,
          answer: "2600",
          explain: md`$2\sum k + \sum 1 = 2 \cdot \frac{50 \cdot 51}{2} + 50 = 2550 + 50 = 2600$.`,
        },
      ],
      practice: [evaluateSigma, sigmaFormulas, writeSigma],
    },
    {
      id: "infinite-geometric-series",
      title: "Infinite geometric series",
      summary: "When adding infinitely many terms gives a finite number, why, and when it doesn't.",
      blocks: [
        {
          kind: "text",
          body: md`Walk halfway to a wall. Then walk half the remaining distance, then half of what is left, forever. The fractions of the distance you cover are
$$\frac{1}{2} + \frac{1}{4} + \frac{1}{8} + \frac{1}{16} + \dots$$
That is infinitely many positive numbers. Does the total grow without end? The picture says no. The pieces fit inside a square of area 1 and never spill out.`,
        },
        { kind: "diagram", ...halvingSquare },
        {
          kind: "text",
          body: md`Nobody can add infinitely many numbers one at a time, so we have to decide what such a sum *means*. The answer: look at the **partial sums** $S_n$, the sum of the first $n$ terms, and see where they head. For the halves,
$$S_1 = \tfrac{1}{2}, \quad S_2 = \tfrac{3}{4}, \quad S_3 = \tfrac{7}{8}, \quad S_4 = \tfrac{15}{16}, \quad \dots, \quad S_n = 1 - \tfrac{1}{2^n}.$$
The gap to 1 halves at every step, so the partial sums get as close to 1 as you like. We say the series **converges** to 1, and write $\frac{1}{2} + \frac{1}{4} + \frac{1}{8} + \dots = 1$.`,
        },
        {
          kind: "key",
          title: "Convergence",
          body: md`An infinite series **converges** to a number $S$ when its partial sums $S_n$ get as close to $S$ as you like, and stay that close, as $n$ grows. That number $S$ is the **sum** of the series.

If the partial sums don't close in on one number, the series **diverges** and has no sum.`,
        },
        {
          kind: "why",
          title: "What happens to the partial sums",
          body: md`Every geometric partial sum has the form $S_n = a_1 \cdot \frac{1 - r^n}{1 - r}$, from Lesson 2. The only part that changes with $n$ is $r^n$. When $|r| < 1$, each multiplication by $r$ shrinks its size by the same factor, so $r^n$ heads toward 0:
$$\begin{array}{c|ccccc} n & 1 & 5 & 10 & 20 & 50 \\ \hline 0.5^n & 0.5 & 0.031 & 0.00098 & 0.00000095 & \approx 10^{-15} \\ 0.9^n & 0.9 & 0.59 & 0.35 & 0.12 & 0.0052 \end{array}$$
It is slower for 0.9, but it gets there. Then $1 - r^n$ heads toward 1, and $S_n$ heads toward $\frac{a_1}{1 - r}$.`,
        },
        {
          kind: "plot",
          x: [0, 13],
          y: [-3, 16],
          curves: [{ expr: "a/(1 - r)", color: 3, dashed: true, label: "S = {=a/(1 - r)}" }],
          points: [
            ...range(1, 12).map((n) => ({ x: n, y: `a(1 - r^${n})/(1 - r)`, color: 1 as const })),
            ...range(1, 12).map((n) => ({ x: n, y: `a r^(${n} - 1)`, color: 2 as const })),
          ],
          params: [
            { name: "a", tex: "a_1", min: 1, max: 3, step: 1, value: 2 },
            { name: "r", min: -0.8, max: 0.8, step: 0.1, value: 0.5 },
          ],
          caption: md`Orange: the terms $a_1 r^{n-1}$, shrinking toward 0. Blue: the partial sums $S_1, S_2, \dots, S_{12}$, levelling off at the dashed line $\frac{a_1}{1 - r}$. Try a negative $r$: the partial sums zigzag, but the zigzags shrink onto the same kind of line.`,
        },
        {
          kind: "proof",
          title: "The sum of an infinite geometric series",
          given: md`A geometric series with first term $a_1$ and ratio $|r| < 1$`,
          prove: md`The partial sums approach $\dfrac{a_1}{1 - r}$`,
          steps: [
            { statement: md`$S_n = a_1 \cdot \dfrac{1 - r^n}{1 - r}$`, reason: "The finite geometric series (Lesson 2)" },
            { statement: md`$\dfrac{a_1}{1 - r} - S_n = \dfrac{a_1 r^n}{1 - r}$`, reason: "Subtract the fractions: they share the denominator 1 - r" },
            { statement: md`$|r|^n$ gets as close to 0 as you like as $n$ grows`, reason: md`Each step multiplies by $|r| < 1$ (see the table; a full proof uses limits, in calculus)` },
            { statement: md`The gap $\dfrac{a_1 r^n}{1 - r}$ shrinks toward 0`, reason: md`$a_1$ and $1 - r$ are fixed numbers, so the gap is a fixed multiple of $r^n$` },
            { statement: md`$S_n$ approaches $\dfrac{a_1}{1 - r}$`, reason: "The distance between them shrinks toward 0, which is the definition of converging" },
          ],
        },
        {
          kind: "key",
          title: "Infinite geometric series",
          body: md`If $|r| < 1$, then
$$a_1 + a_1 r + a_1 r^2 + \dots = \sum_{k=1}^{\infty} a_1 r^{k-1} = \frac{a_1}{1 - r}.$$
An upper limit of $\infty$ means the index never stops. The sum is the number the partial sums approach.
If $|r| \ge 1$ (and $a_1 \ne 0$), the series diverges.`,
        },
        {
          kind: "why",
          title: "Why there is no sum when |r| ≥ 1",
          body: md`Then the terms never shrink: every term is at least as big as $a_1$ in size. Each new term moves the partial sum by at least that much, so the partial sums can't close in on one number.

With $r = 1$, $2 + 2 + 2 + \dots$ has $S_n = 2n$, growing forever. With $r = -1$, $2 - 2 + 2 - \dots$ has partial sums $2, 0, 2, 0, \dots$, bouncing forever. With $|r| > 1$ the terms grow, and it only gets worse.`,
        },
        {
          kind: "plot",
          x: [0, 9],
          y: [-2, 24],
          points: [
            ...range(1, 8).map((n) => ({ x: n, y: 20 * (1.1 ** n - 1), color: 4 as const })),
            ...range(1, 8).map((n) => ({ x: n, y: n % 2 ? 2 : 0, color: 2 as const })),
          ],
          caption: md`Red: partial sums of $2 + 2.2 + 2.42 + \dots$ (ratio 1.1), climbing without end. Orange: partial sums of $2 - 2 + 2 - \dots$ (ratio $-1$), bouncing between 2 and 0. Neither settles on a number.`,
        },
        {
          kind: "why",
          title: "A shortcut, and its trap",
          body: md`If $S = a_1 + a_1 r + a_1 r^2 + \dots$ has a sum, then everything after the first term is $r$ times the whole series. So $S = a_1 + rS$, and solving gives $S = \frac{a_1}{1 - r}$ again.

But that argument *assumed* the sum exists. Try it on $1 + 2 + 4 + 8 + \dots$: $S = 1 + 2S$ gives $S = -1$, which is absurd for a sum of positive numbers. Algebra on a number that doesn't exist can "prove" anything. That is why you check $|r| < 1$ first.`,
        },
        {
          kind: "example",
          title: "Finding a sum",
          problem: md`Find $12 + 4 + \frac{4}{3} + \dots$.`,
          steps: [
            { math: md`a_1 = 12, \quad r = \frac{4}{12} = \frac{1}{3}`, note: "" },
            { math: md`|r| = \frac{1}{3} < 1`, note: "So the series converges." },
            { math: md`S = \frac{12}{1 - \frac{1}{3}} = \frac{12}{\frac{2}{3}} = 18`, note: "Dividing by 2/3 is multiplying by 3/2." },
          ],
        },
        {
          kind: "example",
          title: "A negative ratio",
          problem: md`Find $\sum_{k=1}^{\infty} 5\left(-\frac{1}{2}\right)^{k-1}$.`,
          steps: [
            { math: md`a_1 = 5, \quad r = -\frac{1}{2}`, note: md`At $k = 1$ the exponent is $k - 1 = 0$, and $\left(-\frac{1}{2}\right)^0 = 1$, so the first term is 5.` },
            { math: md`S = \frac{5}{1 - \left(-\frac{1}{2}\right)} = \frac{5}{\frac{3}{2}} = \frac{10}{3}`, note: md`The partial sums $5, 2.5, 3.75, 3.125, \dots$ zigzag in on $3.333\dots$` },
          ],
        },
        {
          kind: "example",
          title: "Repeating decimals are geometric series",
          problem: md`Write $0.\overline{36}$ as a fraction.`,
          steps: [
            { math: md`0.363636\ldots = \frac{36}{100} + \frac{36}{10000} + \frac{36}{1000000} + \dots`, note: "Each copy of the block 36 is worth a hundredth of the one before." },
            { math: md`a_1 = \frac{36}{100}, \quad r = \frac{1}{100}`, note: "" },
            { math: md`S = \frac{36/100}{99/100} = \frac{36}{99} = \frac{4}{11}`, note: "Every repeating decimal is a fraction, for this reason." },
          ],
        },
        {
          kind: "text",
          body: md`The same reasoning settles an old argument. $0.\overline{9} = \frac{9}{10} + \frac{9}{100} + \dots = \frac{9/10}{1 - 1/10} = 1$. Not *almost* 1. The partial sums $0.9, 0.99, 0.999, \dots$ get as close to 1 as you like, and by the definition of an infinite sum that makes the sum exactly 1. It is one number with two decimal names.`,
        },
        {
          kind: "check",
          prompt: md`Find $\sum_{k=1}^{\infty} 6\left(\frac{1}{3}\right)^{k}$.`,
          answer: "3",
          explain: md`At $k = 1$ the term is $6 \cdot \frac{1}{3} = 2$, so $a_1 = 2$, not 6. With $r = \frac{1}{3}$, $S = \frac{2}{1 - 1/3} = \frac{2}{2/3} = 3$.`,
        },
        {
          kind: "check",
          prompt: md`Find the sum of $6 + 2 + \frac{2}{3} + \dots$.`,
          answer: "9",
          explain: md`$a_1 = 6$ and $r = \frac{1}{3}$, so $S = \frac{6}{2/3} = 9$.`,
        },
        {
          kind: "check",
          prompt: md`Find the sum of $2 + 3 + \frac{9}{2} + \dots$. If it has no sum, type **diverges**.`,
          accept: DIVERGES,
          explain: md`$r = \frac{3}{2}$, and $|r| \ge 1$: the terms keep growing, so the series diverges.`,
        },
      ],
      practice: [infiniteSeries, repeatingAndUnknowns, seriesApplications],
    },
  ],
};
