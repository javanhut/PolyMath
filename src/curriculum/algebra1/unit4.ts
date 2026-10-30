import { frac, fracTex, gcd, paren, poly, signed, type Rng } from "../../math/random";
import { md, type Generator, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Pick an index with probability proportional to its weight. */
function weighted(r: Rng, weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let t = r.next() * total;
  for (let i = 0; i < weights.length; i++) {
    t -= weights[i]!;
    if (t < 0) return i;
  }
  return weights.length - 1;
}

function shuffle<T>(r: Rng, items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const units = (n: number, word = "unit") => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A coefficient written in front of a bracket: 1 -> "", -1 -> "-". */
const co = (n: number) => (n === 1 ? "" : n === -1 ? "-" : String(n));

/** Wrap negative LaTeX in brackets, for products like 2/3 · (-3/2). */
const parenTex = (s: string) => (s.startsWith("-") ? md`\left(${s}\right)` : s);

function reduce(n: number, d: number): [number, number] {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
}

/** A slope that is a proper fraction p/q in lowest terms, q from 2 to 5. */
function randFrac(r: Rng): [number, number] {
  const d = r.int(2, 5);
  for (;;) {
    const n = r.nonzero(-5, 5);
    if (gcd(n, d) === 1) return [n, d];
  }
}

/** The x-term of a line with slope n/d, as LaTeX and as typed text. */
function xTerm(n: number, d: number): { tex: string; text: string } {
  [n, d] = reduce(n, d);
  if (n === 0) return { tex: "", text: "" };
  if (d === 1) return { tex: poly([[n, "x"]]), text: poly([[n, "x"]]) };
  return { tex: md`${n < 0 ? "-" : ""}\frac{${Math.abs(n)}}{${d}}x`, text: `${n}/${d}x` };
}

/** The right side of y = (n/d)x + b, as LaTeX and as typed text. b must be an integer. */
function line(n: number, d: number, b: number): { tex: string; text: string } {
  if (!Number.isInteger(b)) throw new Error(`line intercept ${b} is not an integer`);
  const t = xTerm(n, d);
  if (!t.tex) return { tex: String(b), text: String(b) };
  if (b === 0) return t;
  return { tex: `${t.tex} ${signed(b)}`, text: `${t.text} ${signed(b)}` };
}

/** The slope n/d written in front of a bracket, e.g. "3", "-", "\frac{2}{3}". */
const slopeCo = (n: number, d: number) => (d === 1 ? co(n) : fracTex(n, d));

/** "x - 3", "x + 2" or "x": the bracket in point-slope form. */
const minus = (v: string, c: number) => poly([[1, v], [-c, ""]]);

/** Point-slope equation y - y1 = m(x - x1) as LaTeX. */
const pointSlopeTex = (n: number, d: number, x1: number, y1: number) =>
  x1 === 0 ? md`${minus("y", y1)} = ${xTerm(n, d).tex}` : md`${minus("y", y1)} = ${slopeCo(n, d)}(${minus("x", x1)})`;

/** Working from point-slope form to slope-intercept form. */
function pointSlopeSteps(n: number, d: number, x1: number, y1: number): Step[] {
  const c = (-n * x1) / d;
  const steps: Step[] = [{ math: pointSlopeTex(n, d, x1, y1), note: md`Point-slope form through $(${x1}, ${y1})$.` }];
  if (x1 !== 0) steps.push({ math: md`${minus("y", y1)} = ${line(n, d, c).tex}`, note: "Distribute." });
  if (y1 !== 0) steps.push({ math: md`y = ${line(n, d, c + y1).tex}`, note: md`${y1 > 0 ? "Add" : "Subtract"} ${Math.abs(y1)} on both sides.` });
  return steps;
}

/** Ax + By = C with A > 0, |B| > 1, no common factor, and C a multiple of B so the intercept is whole. */
function randStandard(r: Rng, kRange = 5) {
  for (;;) {
    const A = r.int(1, 6);
    const B = r.coef(-5, 5);
    if (gcd(A, B) !== 1) continue;
    const k = r.int(-kRange, kRange);
    return { A, B, C: B * k, k, tex: md`${poly([[A, "x"], [B, "y"]])} = ${B * k}` };
  }
}

const SI = md`Give it in slope-intercept form, $y = mx + b$.`;

// ── Lesson 1 practice: the coordinate plane ─────────────────────────────────

const ROMAN = ["I", "II", "III", "IV"];
const ORDINAL = ["first", "second", "third", "fourth"];
const QUADRANT_ACCEPT = ROMAN.map((q, i) => [q, String(i + 1), `quadrant ${q}`, `quadrant ${i + 1}`, ORDINAL[i]!, `${ORDINAL[i]} quadrant`]);

const coordinates: Generator = (r) => {
  const kind = weighted(r, [3, 3, 2, 3]);
  if (kind === 0) {
    const x = r.nonzero(-9, 9);
    const y = r.nonzero(-9, 9);
    const q = x > 0 ? (y > 0 ? 0 : 3) : y > 0 ? 1 : 2;
    return {
      prompt: md`Which quadrant is the point $(${x}, ${y})$ in? Type I, II, III or IV.`,
      accept: QUADRANT_ACCEPT[q],
      hint: md`Read the signs. A positive $x$ is right of the $y$-axis; a positive $y$ is above the $x$-axis. The quadrants are numbered counterclockwise, starting at the top right.`,
      solution: [
        { math: md`x = ${x} ${x > 0 ? ">" : "<"} 0`, note: x > 0 ? md`Right of the $y$-axis.` : md`Left of the $y$-axis.` },
        { math: md`y = ${y} ${y > 0 ? ">" : "<"} 0`, note: y > 0 ? md`Above the $x$-axis.` : md`Below the $x$-axis.` },
        { math: md`\text{Quadrant ${ROMAN[q]}}`, note: `${x > 0 ? "Right" : "Left"} and ${y > 0 ? "up" : "down"} is Quadrant ${ROMAN[q]}.` },
      ],
    };
  }
  if (kind === 1) {
    const x = r.int(-6, 6);
    const y = r.int(-6, 6);
    const dx = r.nonzero(-7, 7);
    const dy = r.nonzero(-7, 7);
    return {
      prompt: md`Start at $(${x}, ${y})$. Move ${units(Math.abs(dx))} ${dx > 0 ? "right" : "left"} and ${units(Math.abs(dy))} ${dy > 0 ? "up" : "down"}. Where do you land? Give the point as $(x, y)$.`,
      answer: `(${x + dx}, ${y + dy})`,
      form: "tuple",
      hint: "Moving right or left changes only the first coordinate. Moving up or down changes only the second.",
      solution: [
        { math: md`x: ${x} ${signed(dx)} = ${x + dx}`, note: `${dx > 0 ? "Right" : "Left"} is the ${dx > 0 ? "positive" : "negative"} direction along the x-axis.` },
        { math: md`y: ${y} ${signed(dy)} = ${y + dy}`, note: `${dy > 0 ? "Up" : "Down"} is the ${dy > 0 ? "positive" : "negative"} direction along the y-axis.` },
        { math: md`(${x + dx}, ${y + dy})`, note: "The two moves don't interfere, because they run along different axes." },
      ],
    };
  }
  if (kind === 2) {
    let x = r.nonzero(-8, 8);
    let y = r.nonzero(-8, 8);
    if (r.next() < 0.3) {
      if (r.next() < 0.5) y = 0;
      else x = 0;
    }
    const across = x === 0 ? md`on the $y$-axis` : md`${units(Math.abs(x))} ${x > 0 ? "right" : "left"} of the $y$-axis`;
    const upDown = y === 0 ? md`on the $x$-axis` : md`${units(Math.abs(y))} ${y > 0 ? "above" : "below"} the $x$-axis`;
    return {
      prompt: md`A point is ${across} and ${upDown}. What are its coordinates? Give the point as $(x, y)$.`,
      answer: `(${x}, ${y})`,
      form: "tuple",
      hint: md`Distance from the $y$-axis is the $x$-coordinate: positive to the right, negative to the left. Distance from the $x$-axis is the $y$-coordinate: positive above, negative below.`,
      solution: [
        {
          math: md`x = ${x}`,
          note: x === 0 ? md`Every point on the $y$-axis has $x = 0$.` : md`${x > 0 ? "Right" : "Left"} of the $y$-axis, so $x$ is ${x > 0 ? "positive" : "negative"}.`,
        },
        {
          math: md`y = ${y}`,
          note: y === 0 ? md`Every point on the $x$-axis has $y = 0$.` : md`${y > 0 ? "Above" : "Below"} the $x$-axis, so $y$ is ${y > 0 ? "positive" : "negative"}.`,
        },
        { math: md`(${x}, ${y})`, note: "First coordinate across, second up or down." },
      ],
    };
  }
  const m = r.nonzero(-4, 4);
  const b = r.int(-6, 6);
  const x0 = r.nonzero(-5, 5);
  const on = r.next() < 0.5;
  const v = m * x0 + b;
  const y0 = on ? v : v + r.nonzero(-2, 2);
  const E = poly([[m, "x"], [b, ""]]);
  return {
    prompt: md`Is the point $(${x0}, ${y0})$ on the graph of $y = ${E}$? Answer yes or no.`,
    accept: on ? ["yes"] : ["no"],
    hint: md`Substitute the point's $x$-coordinate into the equation, then compare the result with its $y$-coordinate.`,
    solution: [
      { math: md`${co(m)}(${x0})${b ? ` ${signed(b)}` : ""} = ${v}`, note: md`Substitute $x = ${x0}$.` },
      on
        ? { math: md`${v} = ${y0} \;\checkmark`, note: "The coordinates make the equation true, so the point is on the graph." }
        : { math: md`${v} \ne ${y0}`, note: md`At $x = ${x0}$ the graph is at height ${v}, so $(${x0}, ${y0})$ is not on it.` },
    ],
  };
};

const yOnGraph: Generator = (r) => {
  const kind = r.int(0, 3);
  let a = r.nonzero(-5, 5);
  let E: string;
  let v: number;
  let steps: Step[];
  if (kind === 0) {
    const m = r.coef(-6, 6);
    const b = r.nonzero(-9, 9);
    E = poly([[m, "x"], [b, ""]]);
    v = m * a + b;
    steps = [
      { math: md`${m}(${a}) ${signed(b)}`, note: "Substitute, keeping the number in parentheses." },
      { math: md`${m * a} ${signed(b)} = ${v}`, note: "Multiply first, then add." },
    ];
  } else if (kind === 1) {
    const m = r.coef(2, 6);
    const b = r.nonzero(-9, 9);
    E = poly([[b, ""], [-m, "x"]]);
    v = b - m * a;
    steps = [
      { math: md`${b} - ${m}(${a})`, note: "Substitute, keeping the number in parentheses." },
      { math: md`${b} ${signed(-m * a)} = ${v}`, note: "Multiply first, then add." },
    ];
  } else if (kind === 2) {
    a = r.nonzero(-4, 4);
    const s = r.pick([1, -1]);
    const bb = r.int(-4, 4);
    const c = r.int(-6, 6);
    E = poly([[s, "x^2"], [bb, "x"], [c, ""]]);
    v = s * a * a + bb * a + c;
    const middle = bb ? ` ${bb < 0 ? "-" : "+"} ${co(Math.abs(bb))}(${a})` : "";
    const more = bb !== 0 || c !== 0;
    steps = [
      { math: md`${s < 0 ? "-" : ""}(${a})^2${middle}${c ? ` ${signed(c)}` : ""}`, note: "Substitute, keeping the number in parentheses." },
      {
        math: more ? md`${s * a * a}${bb ? ` ${signed(bb * a)}` : ""}${c ? ` ${signed(c)}` : ""} = ${v}` : String(v),
        note: md`Square first: $(${a})^2 = ${a * a}$.${s < 0 ? " The minus in front waits until after the square." : ""}${more ? " Then multiply and add." : ""}`,
      },
    ];
  } else {
    const d = r.int(2, 4);
    const p = r.pick([1, 2, 3].filter((n) => gcd(n, d) === 1));
    const b = r.nonzero(-8, 8);
    a = d * r.nonzero(-3, 3);
    E = md`\frac{${p}}{${d}}x ${signed(b)}`;
    v = (p * a) / d + b;
    steps = [
      { math: md`\frac{${p}}{${d}}(${a}) ${signed(b)}`, note: "Substitute, keeping the number in parentheses." },
      { math: md`${(p * a) / d} ${signed(b)} = ${v}`, note: md`$${a} \div ${d} = ${a / d}$${p === 1 ? "" : md`, and $${p} \cdot ${paren(a / d)} = ${(p * a) / d}$`}. Then add.` },
    ];
  }
  return {
    prompt: md`Evaluate $${E}$ when $x = ${a}$. The answer is the $k$ that puts the point $(${a}, k)$ on the graph of $y = ${E}$.`,
    answer: String(v),
    hint: md`Replace $x$ with $(${a})$ and work it out. The result is the $y$-coordinate that goes with $x = ${a}$.`,
    solution: [...steps, { math: md`(${a}, ${v})`, note: md`So $k = ${v}$, and the point $(${a}, ${v})$ is on the graph.` }],
  };
};

const xOnGraph: Generator = (r) => {
  const kind = r.int(0, 2);
  let h = r.nonzero(-6, 6);
  let E: string;
  let k: number;
  let steps: Step[];
  if (kind === 0) {
    const m = r.coef(-6, 6);
    const b = r.nonzero(-10, 10);
    E = poly([[m, "x"], [b, ""]]);
    k = m * h + b;
    steps = [
      { math: md`${m}x = ${k - b}`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} on both sides.` },
      { math: md`x = ${h}`, note: md`Divide both sides by ${m}.` },
    ];
  } else if (kind === 1) {
    const m = r.coef(2, 6);
    const b = r.nonzero(-10, 10);
    E = poly([[b, ""], [-m, "x"]]);
    k = b - m * h;
    steps = [
      { math: md`-${m}x = ${k - b}`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} on both sides. The coefficient of $x$ is $-${m}$.` },
      { math: md`x = ${h}`, note: md`Divide both sides by $-${m}$.` },
    ];
  } else {
    const d = r.int(2, 5);
    const b = r.nonzero(-8, 8);
    h = d * r.nonzero(-4, 4);
    E = md`\frac{x}{${d}} ${signed(b)}`;
    k = h / d + b;
    steps = [
      { math: md`\frac{x}{${d}} = ${k - b}`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} on both sides.` },
      { math: md`x = ${h}`, note: md`Multiply both sides by ${d}.` },
    ];
  }
  return {
    prompt: md`Solve $${E} = ${k}$. The solution is the $h$ that puts the point $(h, ${k})$ on the graph of $y = ${E}$.`,
    answer: String(h),
    hint: md`Undo what was done to $x$, in reverse order, exactly as in Unit 2.`,
    solution: [...steps, { math: md`(${h}, ${k})`, note: md`So $h = ${h}$. This point's coordinates make the equation true, so it's on the graph.` }],
  };
};

// ── Lesson 2 practice: functions ────────────────────────────────────────────

const functionValues: Generator = (r) => {
  const kind = r.int(0, 3);
  let t = r.nonzero(-6, 6);
  let E: string;
  let sub: string;
  let mid: string;
  let v: number;
  if (kind === 0) {
    const a = r.coef(-7, 7);
    const b = r.nonzero(-12, 12);
    E = poly([[a, "x"], [b, ""]]);
    sub = md`${a}(${t}) ${signed(b)}`;
    mid = md`${a * t} ${signed(b)}`;
    v = a * t + b;
  } else if (kind === 1) {
    const a = r.coef(2, 6);
    const b = r.int(1, 15);
    E = poly([[b, ""], [-a, "x"]]);
    sub = md`${b} - ${a}(${t})`;
    mid = md`${b} ${signed(-a * t)}`;
    v = b - a * t;
  } else if (kind === 2) {
    t = r.nonzero(-3, 3);
    const a = r.pick([1, -1, 2]);
    const b = r.int(-5, 5);
    const c = r.int(-6, 6);
    E = poly([[a, "x^2"], [b, "x"], [c, ""]]);
    sub = md`${co(a)}(${t})^2${b ? ` ${b < 0 ? "-" : "+"} ${co(Math.abs(b))}(${t})` : ""}${c ? ` ${signed(c)}` : ""}`;
    mid = md`${a * t * t}${b ? ` ${signed(b * t)}` : ""}${c ? ` ${signed(c)}` : ""}`;
    v = a * t * t + b * t + c;
  } else {
    const a = r.coef(-5, 5);
    const c = r.nonzero(-6, 6);
    E = md`${a}(${poly([[1, "x"], [c, ""]])})`;
    sub = md`${a}(${t} ${signed(c)})`;
    mid = md`${a}(${t + c})`;
    v = a * (t + c);
  }
  return {
    prompt: md`Evaluate $${E}$ when $x = ${t}$. In function notation: find $f(${t})$ for the function $f(x) = ${E}$.`,
    answer: String(v),
    hint: md`$f(${t})$ means: put ${t} in place of every $x$ in the rule. Use parentheses.`,
    solution: [
      { math: md`f(${t}) = ${sub}`, note: md`Replace every $x$ with $(${t})$.` },
      ...(mid === String(v) ? [] : [{ math: md`= ${mid}`, note: kind === 2 ? "Square first, then multiply." : kind === 3 ? "Brackets first." : "Multiply first." }]),
      { math: md`= ${v}`, note: md`So $f(${t}) = ${v}$: the input ${t} gives the output ${v}.` },
    ],
  };
};

const isFunction: Generator = (r) => {
  const kind = weighted(r, [3, 1, 1]);
  const fn = kind === 2 ? true : kind === 1 ? false : r.next() < 0.5;
  const n = r.int(4, 5);
  const inputs = shuffle(
    r,
    Array.from({ length: 15 }, (_, i) => i - 5),
  ).slice(0, n);
  const outputs = inputs.map(() => r.int(-9, 9));
  if (r.next() < 0.5) outputs[1] = outputs[0]!;
  const repeatedOutput = fn && outputs[1] === outputs[0];
  const pairs = inputs.map((x, i): [number, number] => [x, outputs[i]!]);
  const dup = inputs[0]!;
  let other = r.int(-9, 9);
  while (other === outputs[0]) other = r.int(-9, 9);
  if (!fn) pairs[n - 1] = [dup, other];
  const shown = shuffle(r, pairs);
  const set = md`\{${shown.map(([a, b]) => `(${a}, ${b})`).join(", ")}\}`;

  const notFnSteps: Step[] = [
    { math: md`(${dup}, ${outputs[0]}), \ (${dup}, ${other})`, note: md`The input ${dup} appears twice, with two different outputs.` },
    { math: md`\text{not a function}`, note: "One input with two outputs breaks the definition." },
  ];

  if (kind === 1) {
    return {
      prompt: md`The relation $${set}$ is not a function. Which input has more than one output?`,
      answer: String(dup),
      hint: "Look only at the first number in each pair. Which one appears twice?",
      solution: notFnSteps,
    };
  }
  if (kind === 2) {
    const range = [...new Set(outputs)];
    return {
      prompt: md`The relation $${set}$ is a function. What is its range? List the outputs, separated by commas.`,
      answer: range.join(", "),
      form: "set",
      hint: "The range is the set of outputs: the second number in each pair. List each value once.",
      solution: [
        { math: md`\text{outputs: } ${shown.map(([, b]) => b).join(", ")}`, note: "Read the second number of every pair." },
        { math: md`\{${[...range].sort((a, b) => a - b).join(", ")}\}`, note: repeatedOutput ? "A value that appears twice is listed once." : "Each value once." },
      ],
    };
  }
  return {
    prompt: md`Is the relation $${set}$ a function? Answer yes or no.`,
    accept: fn ? ["yes"] : ["no"],
    hint: "Look only at the inputs, the first numbers. A function never pairs one input with two different outputs.",
    solution: fn
      ? [
          { math: md`\text{inputs: } ${[...inputs].sort((a, b) => a - b).join(", ")}`, note: "Each input appears exactly once, so each has exactly one output." },
          ...(repeatedOutput ? [{ math: md`(${inputs[0]}, ${outputs[0]}), \ (${inputs[1]}, ${outputs[1]})`, note: "Two inputs share an output. That's allowed." }] : []),
          { math: md`\text{a function}`, note: "" },
        ]
      : notFnSteps,
  };
};

const inputForOutput: Generator = (r) => {
  const kind = r.int(0, 2);
  const x = r.nonzero(-8, 8);
  let E: string;
  let k: number;
  let steps: Step[];
  if (kind === 0) {
    const a = r.coef(-6, 6);
    const b = r.nonzero(-10, 10);
    E = poly([[a, "x"], [b, ""]]);
    k = a * x + b;
    steps = [
      { math: md`${a}x = ${k - b}`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} on both sides.` },
      { math: md`x = ${x}`, note: md`Divide both sides by ${a}.` },
    ];
  } else if (kind === 1) {
    const a = r.coef(2, 6);
    const b = r.int(1, 15);
    E = poly([[b, ""], [-a, "x"]]);
    k = b - a * x;
    steps = [
      { math: md`-${a}x = ${k - b}`, note: md`Subtract ${b} from both sides.` },
      { math: md`x = ${x}`, note: md`Divide both sides by $-${a}$.` },
    ];
  } else {
    const a = r.coef(2, 5);
    const c = r.nonzero(-6, 6);
    E = md`${a}(${poly([[1, "x"], [c, ""]])})`;
    k = a * (x + c);
    steps = [
      { math: md`${poly([[1, "x"], [c, ""]])} = ${x + c}`, note: md`Divide both sides by ${a}.` },
      { math: md`x = ${x}`, note: md`${c > 0 ? "Subtract" : "Add"} ${Math.abs(c)} on both sides.` },
    ];
  }
  return {
    prompt: md`Solve $${E} = ${k}$. The solution is the input that the function $f(x) = ${E}$ turns into the output ${k}.`,
    answer: String(x),
    hint: "Asking which input gives a certain output is an ordinary equation: the rule equals that output.",
    solution: [
      { math: md`${E} = ${k}`, note: md`The output $f(x)$ must equal ${k}.` },
      ...steps,
      { math: md`f(${x}) = ${k} \;\checkmark`, note: md`Check by putting ${x} back into the rule.` },
    ],
  };
};

// ── Lesson 3 practice: slope ────────────────────────────────────────────────

const UNDEFINED = ["undefined", "undefined slope", "no slope", "none", "not defined", "does not exist", "dne"];

const slopeFromPoints: Generator = (r) => {
  const kind = weighted(r, [3, 3, 1, 1, 2]);
  if (kind === 4) {
    const useFrac = r.next() < 0.4;
    const [n, d] = useFrac ? randFrac(r) : [r.nonzero(-4, 4), 1];
    const run = useFrac ? d * r.nonzero(-3, 3) : r.nonzero(-5, 5);
    const rise = (n * run) / d;
    const x1 = r.int(-5, 5);
    const y1 = r.int(-6, 6);
    const x2 = x1 + run;
    const k = y1 + rise;
    return {
      prompt: md`A line with slope $${fracTex(n, d)}$ passes through $(${x1}, ${y1})$ and $(${x2}, k)$. Find $k$.`,
      answer: String(k),
      hint: "Find the run between the two x-coordinates. Slope is rise per unit of run, so the rise is the slope times the run.",
      solution: [
        { math: md`\text{run} = ${x2} - ${paren(x1)} = ${run}`, note: md`From $x = ${x1}$ to $x = ${x2}$.` },
        { math: md`\text{rise} = ${fracTex(n, d)} \cdot ${paren(run)} = ${rise}`, note: "Rise = slope times run." },
        { math: md`k = ${y1} ${signed(rise)} = ${k}`, note: "Start at the first point's height and add the rise." },
      ],
    };
  }
  const x1 = r.int(-6, 6);
  const y1 = r.int(-6, 6);
  let run: number;
  let rise: number;
  if (kind === 0) {
    run = r.nonzero(-5, 5);
    rise = run * r.nonzero(-4, 4);
  } else if (kind === 1) {
    run = r.int(2, 6) * r.sign();
    rise = r.nonzero(-9, 9);
    while (rise % run === 0) rise = r.nonzero(-9, 9);
  } else if (kind === 2) {
    run = r.nonzero(-6, 6);
    rise = 0;
  } else {
    run = 0;
    rise = r.nonzero(-8, 8);
  }
  const x2 = x1 + run;
  const y2 = y1 + rise;
  const prompt = md`Find the slope of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$. Give an exact answer. If the slope is undefined, type **undefined**.`;
  const formula = { math: md`m = \frac{${y2} - ${paren(y1)}}{${x2} - ${paren(x1)}}`, note: "Change in $y$ over change in $x$, subtracting in the same order on top and bottom." };
  const hint = md`Slope is $\frac{y_2 - y_1}{x_2 - x_1}$. Put negative coordinates in parentheses.`;
  if (kind === 3) {
    return {
      prompt,
      accept: UNDEFINED,
      hint,
      solution: [
        formula,
        { math: md`= \frac{${rise}}{0}`, note: "The run is 0: both points have the same $x$-coordinate, so the line is vertical." },
        { math: md`\text{undefined}`, note: "Division by zero has no meaning, so a vertical line has no slope." },
      ],
    };
  }
  const m = rise / run;
  return {
    prompt,
    answer: frac(rise, run),
    simplified: true,
    hint,
    solution: [
      formula,
      { math: md`= \frac{${rise}}{${run}}`, note: "" },
      {
        math: md`= ${fracTex(rise, run)}`,
        note: m === 0 ? "No rise at all: the line is horizontal." : m > 0 ? "Positive: the line rises from left to right." : "Negative: the line falls from left to right.",
      },
    ],
  };
};

interface RateStory {
  sign: 1 | -1;
  /** Rate, start and time for a fresh problem. */
  numbers: (r: Rng) => { R: number; S: number; T: number };
  /** Setup sentence; E is the expression in t. */
  setup: (S: number, R: number, E: string) => string;
  evalAsk: (T: number) => string;
  solveAsk: (V: number) => string;
  /** Singular units of time and amount, for notes. */
  time: string;
  amount: string;
}

const STORIES: RateStory[] = [
  {
    sign: -1,
    numbers: (r) => {
      const R = r.int(2, 6);
      const T = r.int(2, 8);
      return { R, T, S: R * T + 5 * r.int(1, 8) };
    },
    setup: (S, R, E) => md`A tank starts with ${S} litres and drains at a steady ${R} litres per minute, so after $t$ minutes it holds $${E}$ litres.`,
    evalAsk: (T) => `The answer is the amount left after ${T} minutes.`,
    solveAsk: (V) => `The solution is the number of minutes until ${V} litres are left.`,
    time: "minute",
    amount: "litre",
  },
  {
    sign: 1,
    numbers: (r) => ({ R: r.pick([5, 10, 15, 20, 25]), S: 5 * r.int(2, 12), T: r.int(2, 10) }),
    setup: (S, R, E) => md`Mia has ${S} dollars saved and adds ${R} dollars every week, so after $t$ weeks she has $${E}$ dollars.`,
    evalAsk: (T) => `The answer is her savings after ${T} weeks.`,
    solveAsk: (V) => `The solution is the number of weeks until she has ${V} dollars.`,
    time: "week",
    amount: "dollar",
  },
  {
    sign: 1,
    numbers: (r) => ({ R: r.int(2, 5), S: r.int(2, 10), T: r.int(2, 8) }),
    setup: (S, R, E) => md`A seedling is ${S} cm tall and grows ${R} cm per week, so after $t$ weeks its height is $${E}$ cm.`,
    evalAsk: (T) => `The answer is its height after ${T} weeks.`,
    solveAsk: (V) => `The solution is the number of weeks until it is ${V} cm tall.`,
    time: "week",
    amount: "centimetre",
  },
  {
    sign: -1,
    numbers: (r) => {
      const R = r.int(2, 4);
      const T = r.int(2, 7);
      return { R, T, S: R * T + r.int(2, 12) };
    },
    setup: (S, R, E) => md`A candle is ${S} cm tall and burns down ${R} cm per hour, so after $t$ hours it is $${E}$ cm tall.`,
    evalAsk: (T) => `The answer is its height after ${T} hours.`,
    solveAsk: (V) => `The solution is the number of hours until it is ${V} cm tall.`,
    time: "hour",
    amount: "centimetre",
  },
];

const DATA_STORIES: { sign: 1 | -1; rates: number[]; base: [number, number]; text: (x1: number, y1: number, x2: number, y2: number) => string; unit: string }[] = [
  {
    sign: 1,
    rates: [40, 60, 80, 120, 150, 200],
    base: [3, 12],
    text: (x1, y1, x2, y2) => `A hiker climbs at a steady pace. After ${x1} hours she is at an elevation of ${y1} m, and after ${x2} hours she is at ${y2} m.`,
    unit: "metres per hour",
  },
  {
    sign: -1,
    rates: [2, 3, 4, 5, 6, 8],
    base: [2, 8],
    text: (x1, y1, x2, y2) => `A tank drains at a steady rate. After ${x1} minutes it holds ${y1} litres, and after ${x2} minutes it holds ${y2} litres.`,
    unit: "litres per minute",
  },
  {
    sign: 1,
    rates: [5, 10, 15, 20, 25],
    base: [1, 8],
    text: (x1, y1, x2, y2) => `Sam saves the same amount every week. After ${x1} weeks he has ${y1} dollars, and after ${x2} weeks he has ${y2} dollars.`,
    unit: "dollars per week",
  },
  {
    sign: -1,
    rates: [2, 3, 4, 5],
    base: [1, 5],
    text: (x1, y1, x2, y2) => `During a video call a phone's battery drops at a steady rate. After ${x1} minutes it is at ${y1} percent, and after ${x2} minutes it is at ${y2} percent.`,
    unit: "percentage points per minute",
  },
];

const rates: Generator = (r) => {
  const kind = weighted(r, [2, 2, 3, 3]);
  if (kind === 0) {
    const s = r.pick(DATA_STORIES);
    const rate = r.pick(s.rates);
    const x1 = r.int(1, 4);
    const x2 = x1 + r.int(2, 5);
    const y0 = s.sign > 0 ? 10 * r.int(s.base[0], s.base[1]) * (rate >= 40 ? 10 : 1) : rate * x2 + 5 * r.int(s.base[0], s.base[1]);
    const y1 = y0 + s.sign * rate * x1;
    const y2 = y0 + s.sign * rate * x2;
    return {
      prompt: md`${s.text(x1, y1, x2, y2)} What is the rate of change, in ${s.unit}? Use a negative number for a decrease.`,
      answer: String(s.sign * rate),
      hint: "Rate of change is the change in the amount divided by the change in time.",
      solution: [
        { math: md`\frac{${y2} - ${y1}}{${x2} - ${x1}} = \frac{${y2 - y1}}{${x2 - x1}}`, note: "Change in the amount over change in time." },
        { math: md`= ${s.sign * rate}`, note: `${s.sign > 0 ? "An increase" : "A decrease"} of ${rate} ${s.unit}.` },
      ],
    };
  }
  if (kind === 1) {
    const step = r.int(1, 3);
    const x0 = r.int(-3, 2);
    const dy = r.nonzero(-9, 9);
    const y0 = r.int(-8, 8);
    const xs = [0, 1, 2, 3].map((i) => x0 + step * i);
    const ys = [0, 1, 2, 3].map((i) => y0 + dy * i);
    return {
      prompt: md`The points in this table lie on a line. What is its slope? Give an exact answer. $$\begin{array}{c|cccc} x & ${xs.join(" & ")} \\ \hline y & ${ys.join(" & ")} \end{array}$$`,
      answer: frac(dy, step),
      simplified: true,
      hint: "Compare neighbouring columns. How much does x change, and how much does y change?",
      solution: [
        { math: md`\Delta x = ${step}, \quad \Delta y = ${dy}`, note: "From each column to the next, $x$ changes by the same amount, and so does $y$." },
        { math: md`m = \frac{${dy}}{${step}} = ${fracTex(dy, step)}`, note: "Equal steps in $x$ bring equal steps in $y$. Their ratio is the slope." },
      ],
    };
  }
  const s = r.pick(STORIES);
  const { R, S, T } = s.numbers(r);
  const E = s.sign > 0 ? `${S} + ${R}t` : `${S} - ${R}t`;
  const V = S + s.sign * R * T;
  const per = `Each ${s.time} ${s.sign > 0 ? "adds" : "removes"} ${R}`;
  if (kind === 2) {
    return {
      prompt: md`Evaluate $${E}$ when $t = ${T}$. ${s.setup(S, R, E)} ${s.evalAsk(T)}`,
      answer: String(V),
      hint: md`Replace $t$ with ${T}. The rate times the time is the total change.`,
      solution: [
        { math: md`${S} ${s.sign > 0 ? "+" : "-"} ${R}(${T})`, note: `Substitute t = ${T}.` },
        { math: md`= ${S} ${s.sign > 0 ? "+" : "-"} ${R * T} = ${V}`, note: `${per}, so ${T} ${s.time}s change the amount by ${R * T}.` },
      ],
    };
  }
  return {
    prompt: md`Solve $${E} = ${V}$. ${s.setup(S, R, E)} ${s.solveAsk(V)}`,
    answer: String(T),
    hint: "The change from the start is the rate times the time. Undo the start value first, then divide by the rate.",
    solution: [
      { math: md`${s.sign > 0 ? "" : "-"}${R}t = ${V - S}`, note: md`Subtract ${S} from both sides. The amount changed by ${V - S}.` },
      { math: md`t = ${T}`, note: `Divide by ${s.sign * R}. ${per}, so it takes ${T} ${s.time}s.` },
    ],
  };
};

// ── Lesson 4 practice: slope-intercept form ─────────────────────────────────

const writeSI: Generator = (r) => {
  const kind = weighted(r, [2, 3, 3, 2, 2]);
  if (kind === 0) {
    const [n, d] = r.next() < 0.3 ? randFrac(r) : [r.nonzero(-6, 6), 1];
    const b = r.int(-9, 9);
    const L = line(n, d, b);
    const where = r.next() < 0.5 ? md`and $y$-intercept $${b}$` : md`that crosses the $y$-axis at $(0, ${b})$`;
    return {
      prompt: md`Write the equation of the line with slope $${fracTex(n, d)}$ ${where}. ${SI}`,
      answer: L.text,
      simplified: true,
      expanded: true,
      hint: md`In $y = mx + b$, $m$ is the slope and $b$ is where the line crosses the $y$-axis.`,
      solution: [
        { math: md`m = ${fracTex(n, d)}, \quad b = ${b}`, note: "The slope and the intercept are given." },
        { math: md`y = ${L.tex}`, note: md`Put them into $y = mx + b$.` },
      ],
    };
  }
  if (kind === 1 || kind === 3) {
    const [n, d] = kind === 3 ? randFrac(r) : [r.nonzero(-5, 5), 1];
    const x1 = d * r.nonzero(kind === 3 ? -2 : -5, kind === 3 ? 2 : 5);
    const y1 = r.int(-8, 8);
    const mx = (n * x1) / d;
    const b = y1 - mx;
    const L = line(n, d, b);
    return {
      prompt: md`Write the equation of the line with slope $${fracTex(n, d)}$ that passes through $(${x1}, ${y1})$. ${SI}`,
      answer: L.text,
      simplified: true,
      expanded: true,
      hint: md`Start from $y = ${xTerm(n, d).tex} + b$. The point is on the line, so its coordinates make the equation true. That gives an equation for $b$.`,
      solution: [
        { math: md`y = ${xTerm(n, d).tex} + b`, note: "The slope is known; only $b$ is missing." },
        { math: md`${y1} = ${d === 1 ? co(n) : fracTex(n, d)}(${x1}) + b`, note: md`Substitute the point: $x = ${x1}$, $y = ${y1}$.` },
        { math: md`${y1} = ${mx} + b \;\Rightarrow\; b = ${b}`, note: md`${mx > 0 ? "Subtract" : "Add"} ${Math.abs(mx)} on both sides.` },
        { math: md`y = ${L.tex}`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const m = r.nonzero(-4, 4);
    const x1 = r.int(-5, 5);
    const run = r.nonzero(-4, 4);
    const y1 = r.int(-6, 6);
    const x2 = x1 + run;
    const y2 = y1 + m * run;
    const b = y1 - m * x1;
    const L = line(m, 1, b);
    return {
      prompt: md`Write the equation of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$. ${SI}`,
      answer: L.text,
      simplified: true,
      expanded: true,
      hint: "Find the slope from the two points first. Then substitute either point into y = mx + b to find b.",
      solution: [
        { math: md`m = \frac{${y2} - ${paren(y1)}}{${x2} - ${paren(x1)}} = \frac{${m * run}}{${run}} = ${m}`, note: "Slope first." },
        { math: md`${y1} = ${co(m)}(${x1}) + b`, note: md`Substitute $(${x1}, ${y1})$ into $y = ${xTerm(m, 1).tex} + b$.` },
        { math: md`b = ${b}`, note: x1 === 0 ? md`The point $(0, ${y1})$ is the $y$-intercept itself.` : md`${m * x1 > 0 ? "Subtract" : "Add"} ${Math.abs(m * x1)} on both sides.` },
        { math: md`y = ${L.tex}`, note: md`Check with the other point: $${co(m)}(${x2})${b ? ` ${signed(b)}` : ""} = ${y2}$ ✓.` },
      ],
    };
  }
  const form = r.int(0, 3);
  let E: string;
  let n: number;
  let d = 1;
  let b: number;
  if (form === 0) {
    n = r.coef(-7, 7);
    b = r.nonzero(-9, 9);
    E = poly([[b, ""], [n, "x"]]);
  } else if (form === 1) {
    d = r.int(2, 5);
    n = 1;
    b = r.nonzero(-9, 9);
    E = md`\frac{x}{${d}} ${signed(b)}`;
  } else if (form === 2) {
    n = r.coef(-7, 7);
    b = 0;
    E = poly([[n, "x"]]);
  } else {
    n = 0;
    b = r.nonzero(-9, 9);
    E = String(b);
  }
  const shape = form === 3 ? md`y = 0x ${signed(b)}` : md`y = ${line(n, d, b).tex}${b === 0 ? " + 0" : ""}`;
  return {
    prompt: md`What are the slope and $y$-intercept of the line $y = ${E}$? Give them as $(m, b)$.`,
    answer: `(${frac(n, d)}, ${b})`,
    form: "tuple",
    simplified: true,
    hint: md`Rewrite the right side in exactly the shape $mx + b$: the number multiplying $x$, then the constant.`,
    solution: [
      {
        math: shape,
        note:
          form === 3
            ? md`$y$ is the same at every $x$, so the line is horizontal with slope 0.`
            : form === 1
              ? md`Dividing by ${d} is multiplying by $\frac{1}{${d}}$.`
              : form === 2
                ? "No constant term means the intercept is 0: the line passes through the origin."
                : "Write the x-term first. Each sign stays with its term.",
      },
      { math: md`m = ${fracTex(n, d)}, \quad b = ${b}`, note: "" },
    ],
  };
};

const xIntercepts: Generator = (r) => {
  const kind = weighted(r, [3, 2, 2]);
  let E: string;
  let answer: string;
  let steps: Step[];
  let exact = "";
  if (kind === 0 || kind === 2) {
    const m = kind === 0 ? r.coef(-6, 6) : r.coef(2, 6);
    const xr = r.nonzero(-6, 6);
    if (kind === 0) {
      const b = -m * xr;
      E = poly([[m, "x"], [b, ""]]);
      steps = [
        { math: md`0 = ${E}`, note: md`On the $x$-axis, $y = 0$.` },
        { math: md`${-b} = ${m}x`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} on both sides.` },
        { math: md`x = ${xr}`, note: md`Divide by ${m}.` },
      ];
    } else {
      const b = m * xr;
      E = poly([[b, ""], [-m, "x"]]);
      steps = [
        { math: md`0 = ${E}`, note: md`On the $x$-axis, $y = 0$.` },
        { math: md`${m}x = ${b}`, note: md`Add $${m}x$ to both sides.` },
        { math: md`x = ${xr}`, note: md`Divide by ${m}.` },
      ];
    }
    answer = String(xr);
  } else {
    const m = r.coef(2, 6) * r.sign();
    let b = r.nonzero(-9, 9);
    while (b % m === 0) b = r.nonzero(-9, 9);
    E = poly([[m, "x"], [b, ""]]);
    answer = frac(-b, m);
    exact = " Give an exact answer.";
    steps = [
      { math: md`0 = ${E}`, note: md`On the $x$-axis, $y = 0$.` },
      { math: md`${-b} = ${m}x`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} on both sides.` },
      { math: md`x = ${fracTex(-b, m)}`, note: md`Divide by ${m}. The intercept doesn't have to be a whole number.` },
    ];
  }
  return {
    prompt: md`Solve $${E} = 0$ to find where the line $y = ${E}$ crosses the $x$-axis. Give the $x$-value.${exact}`,
    answer,
    simplified: kind === 1,
    hint: md`Every point on the $x$-axis has $y = 0$, so the crossing point makes $${E}$ equal to 0.`,
    solution: [...steps, { math: md`(${kind === 1 ? fracTex(Number(answer.split("/")[0]), Number(answer.split("/")[1] ?? 1)) : answer}, 0)`, note: "That's the $x$-intercept, written as a point." }],
  };
};

const models: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind <= 2) {
    // Something running out: the x-intercept in context.
    const stories = [
      () => {
        const R = r.int(2, 5);
        const T = r.int(3, 10);
        const H = R * T;
        return { E: `${H} - ${R}x`, start: H, R, T, setup: md`A candle is ${H} cm tall and burns ${R} cm per hour, so its height after $x$ hours is $y = ${H} - ${R}x$.`, meaning: "the number of hours until the candle burns out", unit: "hour" };
      },
      () => {
        const R = r.pick([25, 40, 50, 75, 100]);
        const T = r.int(4, 12);
        const H = R * T;
        return { E: `${H} - ${R}x`, start: H, R, T, setup: md`You owe ${H} dollars and pay back ${R} dollars a month, so after $x$ months you owe $y = ${H} - ${R}x$ dollars.`, meaning: "the number of months until the debt is paid off", unit: "month" };
      },
      () => {
        const R = r.int(3, 9);
        const T = r.int(4, 12);
        const H = R * T;
        return { E: `${H} - ${R}x`, start: H, R, T, setup: md`A pool holds ${H} cubic metres of water and drains at ${R} cubic metres per hour, so after $x$ hours it holds $y = ${H} - ${R}x$.`, meaning: "the number of hours until the pool is empty", unit: "hour" };
      },
    ];
    const s = stories[kind]!();
    return {
      prompt: md`Solve $${s.E} = 0$. ${s.setup} The solution is ${s.meaning}: the line's $x$-intercept.`,
      answer: String(s.T),
      hint: md`Here $b = ${s.start}$ is the starting amount and $m = -${s.R}$ is the change per ${s.unit}. Undo the start, then divide by the rate.`,
      solution: [
        { math: md`-${s.R}x = -${s.start}`, note: md`Subtract ${s.start} from both sides.` },
        { math: md`x = ${s.T}`, note: md`Divide by $-${s.R}$. Losing ${s.R} per ${s.unit}, the ${s.start} lasts ${s.T} ${s.unit}s.` },
      ],
    };
  }
  const stories = [
    () => {
      const R = r.int(2, 4);
      const F = r.int(2, 6);
      const T = r.int(3, 15);
      return { R, F, T, per: "per mile", setup: md`A taxi charges a ${F}-dollar flat fee plus ${R} dollars per mile, so a ride of $x$ miles costs $y = ${R}x + ${F}$ dollars.`, meaning: (V: number) => `how many miles you can ride for ${V} dollars` };
    },
    () => {
      const R = r.pick([15, 20, 25, 30, 35]);
      const F = r.pick([20, 30, 40, 50]);
      const T = r.int(2, 12);
      return { R, F, T, per: "a month", setup: md`A gym charges a ${F}-dollar joining fee plus ${R} dollars a month, so $x$ months cost $y = ${R}x + ${F}$ dollars in total.`, meaning: (V: number) => `how many months ${V} dollars pays for` };
    },
  ];
  const s = stories[kind - 3]!();
  const V = s.R * s.T + s.F;
  return {
    prompt: md`Solve $${s.R}x + ${s.F} = ${V}$. ${s.setup} The solution is ${s.meaning(V)}.`,
    answer: String(s.T),
    hint: md`$b = ${s.F}$ is paid once, at the start. Take it away, and what's left is paid at ${s.R} dollars ${s.per}.`,
    solution: [
      { math: md`${s.R}x = ${V - s.F}`, note: md`Subtract the ${s.F}-dollar starting fee.` },
      { math: md`x = ${s.T}`, note: md`Divide by the rate, ${s.R} dollars ${s.per}.` },
    ],
  };
};

// ── Lesson 5 practice: point-slope and standard form ────────────────────────

const forms: Generator = (r) => {
  const kind = weighted(r, [3, 3, 2, 2, 2]);
  if (kind === 0 || kind === 1) {
    const [n, d] = kind === 1 ? randFrac(r) : [r.nonzero(-5, 5), 1];
    const x1 = d * r.nonzero(kind === 1 ? -2 : -6, kind === 1 ? 2 : 6);
    const y1 = r.nonzero(-8, 8);
    const b = y1 - (n * x1) / d;
    const L = line(n, d, b);
    const E = md`${y1} ${n < 0 ? "-" : "+"} ${slopeCo(Math.abs(n), d)}(${minus("x", x1)})`;
    const distributed = md`${y1} ${n < 0 ? "-" : "+"} ${xTerm(Math.abs(n), d).tex} ${signed((-n * x1) / d)}`;
    return {
      prompt: md`Simplify $${E}$ to write the line $y = ${E}$ in slope-intercept form.`,
      answer: L.text,
      simplified: true,
      expanded: true,
      hint: "Distribute the slope over the bracket, then combine the two constants.",
      solution: [
        { math: distributed, note: md`Distribute $${fracTex(n, d)}$ over $(${minus("x", x1)})$.` },
        { math: md`${L.tex}`, note: "Combine the constants. The slope was visible all along; now the intercept is too." },
      ],
    };
  }
  if (kind === 2) {
    const m = r.nonzero(-5, 5);
    const x1 = r.nonzero(-6, 6);
    const y1 = r.nonzero(-8, 8);
    const b = y1 - m * x1;
    const L = line(m, 1, b);
    return {
      prompt: md`Write $${pointSlopeTex(m, 1, x1, y1)}$ in slope-intercept form.`,
      answer: L.text,
      simplified: true,
      expanded: true,
      hint: "Distribute on the right, then move the constant from the left side across.",
      solution: [
        { math: md`${minus("y", y1)} = ${poly([[m, "x"], [-m * x1, ""]])}`, note: "Distribute." },
        { math: md`y = ${L.tex}`, note: md`${y1 > 0 ? "Add" : "Subtract"} ${Math.abs(y1)} on both sides.` },
      ],
    };
  }
  if (kind === 3) {
    const m = r.nonzero(-4, 4);
    const x1 = r.int(-5, 5);
    const run = r.nonzero(-4, 4);
    const y1 = r.int(-6, 6);
    const x2 = x1 + run;
    const y2 = y1 + m * run;
    const b = y1 - m * x1;
    const L = line(m, 1, b);
    return {
      prompt: md`Write the equation of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$. ${SI}`,
      answer: L.text,
      simplified: true,
      expanded: true,
      hint: "Find the slope, write point-slope form with either point, then solve for y.",
      solution: [
        { math: md`m = \frac{${y2} - ${paren(y1)}}{${x2} - ${paren(x1)}} = ${m}`, note: "Slope first." },
        ...pointSlopeSteps(m, 1, x1, y1),
      ],
    };
  }
  const { A, B, C, k, tex } = randStandard(r, 6);
  const L = line(-A, B, k);
  return {
    prompt: md`Write $${tex}$ in slope-intercept form.`,
    answer: L.text,
    simplified: true,
    expanded: true,
    hint: "Get the y-term alone on one side, then divide every term by its coefficient.",
    solution: [
      { math: md`${B}y = ${poly([[-A, "x"], [C, ""]])}`, note: md`${A > 0 ? "Subtract" : "Add"} $${co(Math.abs(A))}x$ on both sides.` },
      { math: md`y = ${L.tex}`, note: md`Divide every term by ${B}. The slope is $-\frac{A}{B} = ${fracTex(-A, B)}$.` },
    ],
  };
};

/** Ax + By = C through (p, 0) and (0, q), with A > 0 and no common factor. */
function standardLine(r: Rng) {
  const p = r.nonzero(-6, 6);
  const q = r.nonzero(-6, 6);
  const g = gcd(p, q);
  const s = q > 0 ? 1 : -1;
  return { A: (s * q) / g, B: (s * p) / g, C: (s * p * q) / g, p, q };
}

const intercepts: Generator = (r) => {
  const kind = weighted(r, [3, 3, 2, 2]);
  const POINT = md`Give it as a point $(x, y)$.`;
  if (kind === 2) {
    const m = r.nonzero(-5, 5);
    const x1 = r.nonzero(-6, 6);
    const y1 = r.nonzero(-8, 8);
    const b = y1 - m * x1;
    return {
      prompt: md`Solve $${pointSlopeTex(m, 1, x1, y1)}$ together with $x = 0$. The solution is the line's $y$-intercept. ${POINT}`,
      answer: `(0, ${b})`,
      form: "tuple",
      hint: md`The $y$-axis is the line $x = 0$. Substitute $x = 0$ and solve for $y$.`,
      solution: [
        { math: md`${minus("y", y1)} = ${co(m)}(0 ${signed(-x1)}) = ${-m * x1}`, note: md`Substitute $x = 0$.` },
        { math: md`y = ${b}`, note: md`${y1 > 0 ? "Add" : "Subtract"} ${Math.abs(y1)} on both sides.` },
        { math: md`(0, ${b})`, note: md`This is the $b$ of slope-intercept form.` },
      ],
    };
  }
  const { A, B, C, p, q } = standardLine(r);
  const eq = md`${poly([[A, "x"], [B, "y"]])} = ${C}`;
  const byPart = (v: number | string) => md`${B < 0 ? "-" : "+"} ${Math.abs(B)}(${v})`;
  /** Solving By = rhs for y, without "1y" or "divide by 1". */
  const solveY = (rhs: number, y: number): Step =>
    B === 1 ? { math: md`y = ${y}`, note: "" } : { math: md`${co(B)}y = ${rhs} \;\Rightarrow\; y = ${y}`, note: md`Divide by ${B}.` };
  if (kind === 0) {
    return {
      prompt: md`Solve $${eq}$ together with $y = 0$. The solution is the line's $x$-intercept. ${POINT}`,
      answer: `(${p}, 0)`,
      form: "tuple",
      hint: md`The $x$-axis is the line $y = 0$. Substitute $y = 0$ and solve for $x$.`,
      solution: [
        { math: md`${co(A)}x ${byPart(0)} = ${C}`, note: md`Substitute $y = 0$. The $y$-term vanishes.` },
        { math: A === 1 ? md`x = ${p}` : md`${A}x = ${C} \;\Rightarrow\; x = ${p}`, note: A === 1 ? "" : md`Divide by ${A}.` },
        { math: md`(${p}, 0)`, note: md`The line crosses the $x$-axis here.` },
      ],
    };
  }
  if (kind === 1) {
    return {
      prompt: md`Solve $${eq}$ together with $x = 0$. The solution is the line's $y$-intercept. ${POINT}`,
      answer: `(0, ${q})`,
      form: "tuple",
      hint: md`The $y$-axis is the line $x = 0$. Substitute $x = 0$ and solve for $y$.`,
      solution: [
        { math: md`${co(A)}(0) ${B < 0 ? "-" : "+"} ${co(Math.abs(B))}y = ${C}`, note: md`Substitute $x = 0$. The $x$-term vanishes.` },
        solveY(C, q),
        { math: md`(0, ${q})`, note: md`The line crosses the $y$-axis here.` },
      ],
    };
  }
  const j = r.nonzero(-2, 2);
  const x0 = p + B * j;
  const y0 = -A * j;
  return {
    prompt: md`Solve $${eq}$ together with $x = ${x0}$. The solution is the point on the line with $x$-coordinate ${x0}. ${POINT}`,
    answer: `(${x0}, ${y0})`,
    form: "tuple",
    hint: md`Substitute $x = ${x0}$, then solve the equation that's left for $y$.`,
    solution: [
      { math: md`${co(A)}(${x0}) ${B < 0 ? "-" : "+"} ${co(Math.abs(B))}y = ${C}`, note: md`Substitute $x = ${x0}$.` },
      { math: md`${co(B)}y = ${C - A * x0}`, note: md`${A * x0 > 0 ? "Subtract" : "Add"} ${Math.abs(A * x0)} on both sides.` },
      ...(B === 1 ? [] : [{ math: md`y = ${y0}`, note: md`Divide by ${B}.` }]),
      { math: md`(${x0}, ${y0})`, note: "" },
    ],
  };
};

// ── Lesson 6 practice: parallel and perpendicular ───────────────────────────

/** A random non-zero slope: a proper fraction or a whole number. */
const anySlope = (r: Rng, fracChance = 0.5): [number, number] => (r.next() < fracChance ? randFrac(r) : [r.coef(-5, 5), 1]);

const slopesPP: Generator = (r) => {
  const kind = weighted(r, [2, 2, 4, 2]);
  if (kind === 0 || kind === 1) {
    const parallel = kind === 0;
    let n: number;
    let d: number;
    let given: string;
    let read: Step;
    if (r.next() < 0.5) {
      [n, d] = anySlope(r);
      const b = r.int(-8, 8);
      given = md`y = ${line(n, d, b).tex}`;
      read = { math: md`m = ${fracTex(n, d)}`, note: md`Read the slope from $y = mx + b$.` };
    } else {
      const std = randStandard(r);
      [n, d] = reduce(-std.A, std.B);
      given = std.tex;
      read = { math: md`m = -\frac{A}{B} = ${fracTex(n, d)}`, note: md`Solving $${given}$ for $y$ makes the $x$-coefficient $${fracTex(n, d)}$.` };
    }
    const [an, ad] = parallel ? [n, d] : reduce(-d, n);
    return {
      prompt: md`What is the slope of a line ${parallel ? "parallel" : "perpendicular"} to $${given}$? Give an exact answer.`,
      answer: frac(an, ad),
      simplified: true,
      hint: parallel ? "Parallel lines have the same slope. Find the given line's slope first." : "Find the given line's slope, then take its negative reciprocal: flip it and change the sign.",
      solution: parallel
        ? [read, { math: md`m_{\parallel} = ${fracTex(an, ad)}`, note: "Parallel lines have equal slopes." }]
        : [
            read,
            { math: md`m_{\perp} = -\frac{1}{m} = ${fracTex(an, ad)}`, note: "Flip the fraction and change its sign." },
            { math: md`${fracTex(n, d)} \cdot ${parenTex(fracTex(an, ad))} = -1 \;\checkmark`, note: "The two slopes multiply to $-1$." },
          ],
    };
  }
  if (kind === 2) {
    const [n, d] = anySlope(r, 0.6);
    const mTex = d === 1 ? String(n) : fracTex(n, d);
    return {
      prompt: md`Solve $${mTex}m = -1$. The solution is the slope of every line perpendicular to a line with slope $${mTex}$.`,
      answer: frac(-d, n),
      simplified: true,
      hint: md`Multiply both sides by the reciprocal of $${mTex}$.`,
      solution: [
        { math: md`m = -1 \cdot ${parenTex(fracTex(d, n))}`, note: md`Multiply both sides by the reciprocal, $${fracTex(d, n)}$. A number times its reciprocal is 1.` },
        { math: md`m = ${fracTex(-d, n)}`, note: "The negative reciprocal, just as the rule says." },
      ],
    };
  }
  const [n, d] = anySlope(r);
  const b1 = r.int(-6, 6);
  const rel = r.pick(["parallel", "perpendicular", "neither"] as const);
  let n2: number;
  let d2: number;
  let b2 = r.int(-6, 6);
  let trap = "";
  if (rel === "parallel") {
    [n2, d2] = [n, d];
    while (b2 === b1) b2 = r.int(-6, 6);
  } else if (rel === "perpendicular") {
    [n2, d2] = reduce(-d, n);
  } else if (r.next() < 0.5) {
    [n2, d2] = reduce(d, n);
    trap = " Flipping the fraction isn't enough: the sign has to change too.";
  } else {
    [n2, d2] = [-n, d];
    trap = " Changing the sign isn't enough: the fraction has to flip too.";
  }
  const accept = rel === "perpendicular" ? ["perpendicular", "perp"] : [rel];
  const product = md`m_1 m_2 = ${fracTex(n, d)} \cdot ${parenTex(fracTex(n2, d2))}`;
  return {
    prompt: md`Lines $\ell_1$ and $\ell_2$ have equations $y = ${line(n, d, b1).tex}$ and $y = ${line(n2, d2, b2).tex}$. Are they parallel, perpendicular, or neither?`,
    accept,
    hint: "Compare the slopes. Equal slopes mean parallel. Slopes that multiply to -1 mean perpendicular.",
    solution: [
      { math: md`m_1 = ${fracTex(n, d)}, \quad m_2 = ${fracTex(n2, d2)}`, note: "Read both slopes." },
      rel === "parallel"
        ? { math: md`m_1 = m_2`, note: "Equal slopes and different intercepts: the lines are parallel." }
        : rel === "perpendicular"
          ? { math: md`${product} = -1`, note: "The slopes multiply to $-1$: the lines are perpendicular." }
          : { math: md`${product} = ${fracTex(n * n2, d * d2)} \ne -1`, note: `The slopes aren't equal and don't multiply to -1, so neither.${trap}` },
    ],
  };
};

const linesPP: Generator = (r) => {
  const kind = weighted(r, [3, 4, 3]);
  let n: number;
  let d: number;
  let given: string;
  let parallel: boolean;
  let readSlope: Step;
  let c: number;
  if (kind === 2) {
    const std = randStandard(r, 4);
    [n, d] = reduce(-std.A, std.B);
    c = std.k;
    given = std.tex;
    parallel = r.next() < 0.5;
    readSlope = { math: md`m = -\frac{A}{B} = ${fracTex(n, d)}`, note: md`The slope of $${given}$, found by solving for $y$.` };
  } else {
    [n, d] = anySlope(r, 0.4);
    c = r.int(-8, 8);
    given = md`y = ${line(n, d, c).tex}`;
    parallel = kind === 0;
    readSlope = { math: md`m = ${fracTex(n, d)}`, note: "The slope of the given line." };
  }
  const [tn, td] = parallel ? [n, d] : reduce(-d, n);
  const x1 = td * (td >= 3 ? r.nonzero(-2, 2) : r.nonzero(-3, 3));
  let y1 = r.int(-8, 8);
  let b = y1 - (tn * x1) / td;
  // A parallel line through a point on the given line would be the same line.
  if (parallel && b === c) {
    y1 += 1;
    b += 1;
  }
  const L = line(tn, td, b);
  return {
    prompt: md`Write the equation of the line through $(${x1}, ${y1})$ that is ${parallel ? "parallel" : "perpendicular"} to $${given}$. ${SI}`,
    answer: L.text,
    simplified: true,
    expanded: true,
    hint: parallel
      ? "A parallel line has the same slope. Use it with the given point in point-slope form."
      : "A perpendicular line has the negative reciprocal slope. Use it with the given point in point-slope form.",
    solution: [
      readSlope,
      {
        math: md`${parallel ? md`m_{\parallel}` : md`m_{\perp}`} = ${fracTex(tn, td)}`,
        note: parallel ? "Parallel: the same slope." : "Perpendicular: flip and change the sign.",
      },
      ...pointSlopeSteps(tn, td, x1, y1),
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

const QII = QUADRANT_ACCEPT[1]!;

export const unit4: Unit = {
  title: "Functions and Graphs",
  lessons: [
    {
      id: "the-coordinate-plane",
      title: "The coordinate plane",
      summary: "Giving every point an address with two numbers, and the graph of an equation as a picture of its solutions.",
      blocks: [
        {
          kind: "text",
          body: md`A number line gives every number a place. But many questions involve **two** numbers at once: hours worked and money earned, the side of a square and its area. To picture pairs of numbers, take two number lines and cross them at right angles, where both read zero.

The horizontal line is the **$x$-axis** and the vertical one is the **$y$-axis**. They cross at the **origin**.`,
        },
        {
          kind: "key",
          title: "Ordered pairs",
          body: md`Every point in the plane has an address $(x, y)$, called an **ordered pair**.

- The first number, $x$, says how far to go **right** from the origin (left if it's negative).
- The second number, $y$, says how far to go **up** (down if it's negative).

These two numbers are the point's **coordinates**. The origin is $(0, 0)$.`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 6],
          points: [
            { x: 4, y: 3, label: "A(4, 3)", color: 1 },
            { x: -3, y: 2, label: "B(-3, 2)", color: 2 },
            { x: -4, y: -3, label: "C(-4, -3)", color: 3 },
            { x: 2, y: -5, label: "D(2, -5)", color: 4 },
          ],
          caption: md`To plot $B(-3, 2)$, start at the origin, go 3 to the left, then 2 up.`,
        },
        {
          kind: "why",
          title: "Why two numbers, and why in order?",
          body: md`One number can't pin down a point in a plane. "3 to the right" describes a whole vertical line of points, from far below the $x$-axis to far above it. A flat surface has two independent directions to move in, so it takes two numbers: one for across, one for up.

The order is a convention everyone agrees on: across first, then up. It matters, because $(4, 3)$ and $(3, 4)$ are different points. Swap the numbers and you land somewhere else.`,
        },
        {
          kind: "text",
          body: md`The axes cut the plane into four **quadrants**, numbered I, II, III and IV counterclockwise, starting at the top right. The signs of the coordinates tell you which one a point is in:

- Quadrant I: $x > 0$ and $y > 0$
- Quadrant II: $x < 0$ and $y > 0$
- Quadrant III: $x < 0$ and $y < 0$
- Quadrant IV: $x > 0$ and $y < 0$

A point with a coordinate of 0 sits on an axis and isn't in any quadrant. $(0, 5)$ is on the $y$-axis, and $(-2, 0)$ is on the $x$-axis.`,
        },
        {
          kind: "check",
          prompt: md`Which quadrant is the point $(-5, 2)$ in? Type I, II, III or IV.`,
          accept: QII,
          explain: md`$x = -5$ is negative, so the point is left of the $y$-axis. $y = 2$ is positive, so it's above the $x$-axis. Left and up is Quadrant II.`,
        },
        {
          kind: "example",
          title: "Moving a point",
          problem: md`Start at $(2, -1)$. Move 5 units left and 3 units up. Where do you land?`,
          steps: [
            { math: md`x: 2 - 5 = -3`, note: "Left and right change only the first coordinate. Left is the negative direction." },
            { math: md`y: -1 + 3 = 2`, note: "Up and down change only the second coordinate." },
            { math: md`(-3, 2)`, note: "The two moves don't interfere, because they run along different axes." },
          ],
        },
        {
          kind: "text",
          body: md`Here is where the plane starts doing real work. The equation $y = 2x - 1$ makes a claim about **two** numbers. Some pairs make it true: $x = 3$, $y = 5$ works, since $2(3) - 1 = 5$. Others make it false: $x = 3$, $y = 4$ doesn't work.

Each pair that works is a point. Pick some values of $x$, work out $y$ for each, and plot the results:

$$\begin{array}{c|ccccc} x & -1 & 0 & 1 & 2 & 3 \\ \hline y & -3 & -1 & 1 & 3 & 5 \end{array}$$`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 6],
          curves: [{ expr: "2x - 1", label: "y = 2x - 1", color: 1 }],
          points: [
            { x: -1, y: -3, color: 2 },
            { x: 0, y: -1, color: 2 },
            { x: 1, y: 1, color: 2 },
            { x: 2, y: 3, color: 2 },
            { x: 3, y: 5, color: 2 },
          ],
          caption: md`The five solutions from the table all lie on one line. Fill in more values of $x$, including fractions, and the points fill in the line.`,
        },
        {
          kind: "key",
          title: "The graph of an equation",
          body: md`The **graph** of an equation in $x$ and $y$ is the set of all points $(x, y)$ whose coordinates make the equation true.

So a point is on the graph exactly when substituting its coordinates gives a true statement.`,
        },
        {
          kind: "why",
          title: "Why test a point by substituting?",
          body: md`Because that's what the graph *is*. The graph isn't a drawing that happens to match the equation. It's defined as the collection of the equation's solutions, so "Is $(4, 7)$ on the graph?" and "Do $x = 4$, $y = 7$ make the equation true?" are the same question.

A drawing is only as accurate as your pencil. Substitution is exact, so it settles cases a picture can't, like whether $(100, 199)$ is on the line. (It is: $2(100) - 1 = 199$.)`,
        },
        {
          kind: "example",
          title: "Is the point on the graph?",
          problem: md`Are $(4, 7)$ and $(-2, -4)$ on the graph of $y = 2x - 1$?`,
          steps: [
            { math: md`2(4) - 1 = 7 \;\checkmark`, note: md`Substitute $x = 4$. The equation demands $y = 7$, which matches, so $(4, 7)$ is on the graph.` },
            { math: md`2(-2) - 1 = -5 \ne -4`, note: md`Substitute $x = -2$. The equation demands $y = -5$, not $-4$, so $(-2, -4)$ is not on the graph. It sits 1 unit above the point $(-2, -5)$.` },
          ],
        },
        {
          kind: "example",
          title: "Finding a missing coordinate",
          problem: md`The point $(h, 9)$ is on the graph of $y = 2x - 1$. Find $h$.`,
          steps: [
            { math: md`9 = 2h - 1`, note: md`Being on the graph means the coordinates satisfy the equation. Substitute $y = 9$ and $x = h$.` },
            { math: md`10 = 2h`, note: "Add 1 to both sides." },
            { math: md`h = 5`, note: md`Divide by 2. Check: $2(5) - 1 = 9$ ✓, so the point is $(5, 9)$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`The point $(3, k)$ is on the graph of $y = 4 - x$. Find $k$.`,
          answer: "1",
          explain: md`Substitute $x = 3$: $y = 4 - 3 = 1$. So $k = 1$, and the point is $(3, 1)$.`,
        },
      ],
      practice: [coordinates, yOnGraph, xOnGraph],
    },
    {
      id: "what-a-function-is",
      title: "What a function is",
      summary: "A rule that gives exactly one output for each input, function notation, and the vertical line test.",
      blocks: [
        {
          kind: "text",
          body: md`Many quantities depend on other quantities. A taxi fare depends on the distance. The area of a square depends on the length of its side. The temperature outside depends on the time of day.

In each case you feed in one number, the **input**, and a rule hands back another, the **output**. That idea is a **function**.`,
        },
        {
          kind: "key",
          title: "Function",
          body: md`A **function** is a rule that assigns to each input **exactly one** output.

The set of allowed inputs is the function's **domain**. The set of outputs it produces is its **range**.`,
        },
        {
          kind: "why",
          title: "Why exactly one output?",
          body: md`The point of a function is prediction. If a rule tells you the fare for a 5-mile ride, you want **one** number, not "maybe 13 dollars, maybe 20". When each input has just one output, the input completely determines the output, so the output is something you can compute, graph and rely on.

Notice what the definition doesn't forbid: two different inputs may share an output. Every person has exactly one birthday, so "person to birthday" is a function, even though many people share a birthday. But "birthday to person" is not a function, because one date belongs to many people.`,
        },
        {
          kind: "text",
          body: md`A function can be listed as a set of (input, output) pairs. To test it, look only at the inputs, the first numbers:

- $\{(1, 4), (2, 7), (3, 10)\}$ is a function. Each input appears once.
- $\{(1, 5), (2, 5), (3, 5)\}$ is a function. The outputs repeat, and that's allowed.
- $\{(1, 4), (2, 7), (1, 9)\}$ is **not** a function. The input 1 has two outputs, 4 and 9.`,
        },
        {
          kind: "check",
          prompt: md`Is the relation $\{(0, 3), (2, 3), (5, -1), (2, 6)\}$ a function? Answer yes or no.`,
          accept: ["no"],
          explain: md`No. The input 2 appears twice, with outputs 3 and 6. The repeated output 3 is fine on its own; the problem is the repeated input.`,
        },
        {
          kind: "key",
          title: "Function notation",
          body: md`Functions get names, usually $f$, $g$ or $h$, and the rule is written like $f(x) = 2x - 1$.

- $f(x)$ is read "$f$ of $x$". It means **the output of $f$ when the input is $x$**.
- $f(3)$ means: replace every $x$ in the rule with 3. So $f(3) = 2(3) - 1 = 5$.

The parentheses here do **not** mean multiplication. $f(3)$ is not "$f$ times 3".`,
        },
        {
          kind: "example",
          title: "Evaluating a function",
          problem: md`Let $f(x) = x^2 - 3x$. Find $f(-2)$ and $f(0)$.`,
          steps: [
            { math: md`f(-2) = (-2)^2 - 3(-2)`, note: md`Replace every $x$ with $(-2)$, in parentheses.` },
            { math: md`= 4 + 6 = 10`, note: md`Square first, then multiply. Subtracting $-6$ adds 6.` },
            { math: md`f(0) = 0^2 - 3(0) = 0`, note: "A different input gives its own output. Each input still gets just one." },
          ],
        },
        {
          kind: "text",
          body: md`The graph of a function $f$ is the graph of the equation $y = f(x)$: all the points $(x, f(x))$. Each input $x$ gets one point, directly above or below it, at height $f(x)$. So "$f(3) = 5$" and "the point $(3, 5)$ is on the graph" say the same thing.`,
        },
        {
          kind: "plot",
          x: [-4, 4],
          y: [-3, 5],
          curves: [{ expr: "x^2 - 2", label: "f(x) = x^2 - 2", color: 1 }],
          points: [{ x: "c", y: "c^2 - 2", label: "(c, f(c))", color: 2 }],
          params: [{ name: "c", label: "c", min: -3, max: 3, step: 0.5, value: 1 }],
          caption: md`Slide the input $c$. Above or below each input there is exactly one point of the graph, at height $f(c)$.`,
        },
        {
          kind: "why",
          title: "Why the vertical line test works",
          body: md`A vertical line is the set of all points with one particular input, like $x = 2$. If that line crosses a graph at two points, say $(2, 3)$ and $(2, -3)$, then the input 2 is paired with two outputs. That breaks the definition.

So a graph is the graph of a function exactly when **no vertical line crosses it more than once**. This is the **vertical line test**. It isn't a new rule, only the definition seen in a picture.`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 6],
          curves: [
            { expr: "sqrt(16 - x^2)", color: 1 },
            { expr: "-sqrt(16 - x^2)", color: 1 },
          ],
          vlines: [{ x: 2 }],
          points: [
            { x: 2, y: "sqrt(12)", color: 4 },
            { x: 2, y: "-sqrt(12)", color: 4 },
          ],
          caption: md`This circle fails the test. The line $x = 2$ crosses it twice, near $(2, 3.46)$ and $(2, -3.46)$, so the input 2 would have two outputs. A circle is a perfectly good graph of an equation, but not of a function.`,
        },
        {
          kind: "example",
          title: "Working backwards: which input?",
          problem: md`Let $f(x) = 3x - 4$. Which input gives the output 11?`,
          steps: [
            { math: md`3x - 4 = 11`, note: md`The output is $f(x)$, so set the rule equal to 11. Now it's an ordinary equation.` },
            { math: md`3x = 15`, note: "Add 4 to both sides." },
            { math: md`x = 5`, note: md`Divide by 3. Check: $f(5) = 15 - 4 = 11$ ✓.` },
          ],
        },
        {
          kind: "check",
          prompt: md`If $f(x) = 10 - 2x$, find $f(-3)$.`,
          answer: "16",
          explain: md`$f(-3) = 10 - 2(-3) = 10 + 6 = 16$.`,
        },
      ],
      practice: [functionValues, isFunction, inputForOutput],
    },
    {
      id: "slope-as-a-rate-of-change",
      title: "Slope as a rate of change",
      summary: "Rise over run, why it's the same everywhere on a line, and what it means as a rate.",
      blocks: [
        {
          kind: "text",
          body: md`A cyclist starts 10 km from home and rides away at a steady pace:

$$\begin{array}{c|cccc} \text{hours} & 0 & 1 & 2 & 3 \\ \hline \text{km from home} & 10 & 25 & 40 & 55 \end{array}$$

Every hour adds the same 15 km. That constant **rate of change**, 15 km per hour, is what makes the points line up. On a graph, the rate shows up as how steep the line is.`,
        },
        {
          kind: "key",
          title: "Slope",
          body: md`The **slope** of a line is
$$m = \frac{\text{rise}}{\text{run}} = \frac{\text{change in } y}{\text{change in } x} = \frac{y_2 - y_1}{x_2 - x_1}$$
for any two points $(x_1, y_1)$ and $(x_2, y_2)$ on the line, with $x_1 \ne x_2$. It tells you how much $y$ changes for each 1 unit that $x$ increases.`,
        },
        {
          kind: "plot",
          x: [-3, 9],
          y: [-5, 7],
          curves: [
            { expr: "m x + 1", color: 1 },
            { expr: "1", domain: [0, 4], dashed: true, color: 2, label: md`\text{run} = 4` },
          ],
          points: [
            { x: 0, y: 1, label: "P", color: 1 },
            { x: 4, y: 1, open: true, color: 2 },
            { x: 4, y: "1 + 4m", label: "Q", color: 3 },
          ],
          params: [{ name: "m", label: "slope m", min: -1.5, max: 1.5, step: 0.25, value: 0.75 }],
          caption: md`From $P$, run 4 to the right to the open dot. The rise from there to $Q$ is $4m$, so rise over run is $\frac{4m}{4} = m$. Drag the slope below zero and the rise becomes a fall.`,
        },
        {
          kind: "why",
          title: "Why is the slope the same wherever you measure it?",
          body: md`Go back to the cyclist. Each 1-hour step adds 15 km. A run of 2 hours is two such steps, so the rise is $2 \cdot 15 = 30$. Any run of $h$ hours is $h$ equal steps, so the rise is $15h$, and
$$\frac{\text{rise}}{\text{run}} = \frac{15h}{h} = 15.$$
It doesn't matter where you start or how far you go: equal steps in $x$ always bring equal steps in $y$.

Geometry tells the same story. Draw two slope triangles anywhere on one line, of any size. Their horizontal sides are parallel, their vertical sides are parallel, and their long sides lie along the same line, so the two triangles have the same angles. Triangles with the same angles are scaled copies of each other (they are **similar**), so their sides come in the same ratio. Rise over run is the same for both. A constant ratio is exactly what makes a line straight.`,
        },
        {
          kind: "example",
          title: "Slope from two points",
          problem: md`Find the slope of the line through $(1, 2)$ and $(4, 8)$.`,
          steps: [
            { math: md`m = \frac{8 - 2}{4 - 1}`, note: "Second point minus first point, in the same order on top and bottom." },
            { math: md`= \frac{6}{3} = 2`, note: "Each step of 1 to the right raises the line by 2." },
          ],
        },
        {
          kind: "example",
          title: "With negative numbers",
          problem: md`Find the slope of the line through $(-2, 5)$ and $(3, -5)$.`,
          steps: [
            { math: md`m = \frac{-5 - 5}{3 - (-2)}`, note: "Put the negative coordinate in parentheses." },
            { math: md`= \frac{-10}{5} = -2`, note: "A negative slope: the line falls 2 for each step to the right." },
            { math: md`\frac{5 - (-5)}{-2 - 3} = \frac{10}{-5} = -2`, note: "Using the points in the other order gives the same slope." },
          ],
        },
        {
          kind: "why",
          title: "Why the order of the points doesn't matter",
          body: md`Swapping the two points negates both the top and the bottom of the fraction:
$$\frac{y_1 - y_2}{x_1 - x_2} = \frac{-(y_2 - y_1)}{-(x_2 - x_1)} = \frac{y_2 - y_1}{x_2 - x_1}.$$
The two minus signs cancel. What you **can't** do is mix the orders, as in $\frac{y_2 - y_1}{x_1 - x_2}$. That negates only one part and flips the sign of the answer.`,
        },
        {
          kind: "text",
          body: md`The sign of the slope tells you the direction, reading left to right:

- **Positive:** the line rises.
- **Negative:** the line falls.
- **Zero:** the line is flat, or horizontal. The rise is 0 for any run.
- **Undefined:** the line is vertical. The run is 0, and dividing by zero has no meaning, so a vertical line has no slope.`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 6],
          curves: [
            { expr: "0.5x + 1", label: md`m = \tfrac{1}{2}`, color: 1 },
            { expr: "-2x + 3", label: "m = -2", color: 2 },
            { expr: "-3", label: "m = 0", color: 3 },
          ],
          vlines: [{ x: 4 }],
          caption: md`Lines with slopes $\frac{1}{2}$, $-2$ and $0$. The dashed vertical line $x = 4$ has undefined slope.`,
        },
        {
          kind: "text",
          body: md`As a rate, slope carries units: **units of $y$ per unit of $x$**. If a tank holds 50 litres at minute 0 and 30 litres at minute 4, its rate of change is
$$\frac{30 - 50}{4 - 0} = \frac{-20}{4} = -5 \text{ litres per minute}.$$
The negative sign says the amount is going down. Once you know the rate, you can predict: after $t$ minutes the tank has lost $5t$ litres, so it holds $50 - 5t$.`,
        },
        {
          kind: "check",
          prompt: md`Find the slope of the line through $(2, 7)$ and $(6, -1)$.`,
          answer: "-2",
          simplified: true,
          explain: md`$\frac{-1 - 7}{6 - 2} = \frac{-8}{4} = -2$.`,
        },
        {
          kind: "check",
          prompt: md`A candle is 20 cm tall after 1 hour and 14 cm tall after 4 hours, burning at a steady rate. What is its rate of change, in cm per hour?`,
          answer: "-2",
          explain: md`$\frac{14 - 20}{4 - 1} = \frac{-6}{3} = -2$ cm per hour. It loses 2 cm each hour.`,
        },
      ],
      practice: [slopeFromPoints, rates],
    },
    {
      id: "slope-intercept-form",
      title: "Slope-intercept form",
      summary: "Why the line with slope m through (0, b) is y = mx + b, and how to graph and write lines with it.",
      blocks: [
        {
          kind: "text",
          body: md`So far we've measured slope from points. Now turn it around. If you know a line's slope and one point on it, the line is completely determined: start at the point and keep stepping by the slope. The question is which single equation captures every point of that line.`,
        },
        {
          kind: "why",
          title: "Deriving y = mx + b",
          body: md`Take the line with slope $m$ that crosses the $y$-axis at $(0, b)$. Let $(x, y)$ be any other point on it. The slope between these two points has to be $m$:
$$\frac{y - b}{x - 0} = m.$$
Multiply both sides by $x$ to get $y - b = mx$, then add $b$:
$$y = mx + b.$$
It works the other way too. Take any two points that satisfy $y = mx + b$, say $(x_1, mx_1 + b)$ and $(x_2, mx_2 + b)$. The slope between them is
$$\frac{(mx_2 + b) - (mx_1 + b)}{x_2 - x_1} = \frac{m(x_2 - x_1)}{x_2 - x_1} = m.$$
Every pair of points has the same slope $m$, so the graph is a straight line.`,
        },
        {
          kind: "key",
          title: "Slope-intercept form",
          body: md`$$y = mx + b$$

- $m$ is the **slope**.
- $b$ is the **$y$-intercept**: the line crosses the $y$-axis at $(0, b)$.`,
        },
        {
          kind: "why",
          title: "Why b is where the line crosses the y-axis",
          body: md`Every point on the $y$-axis has $x = 0$. Put $x = 0$ into the equation: $y = m \cdot 0 + b = b$. So the line meets the $y$-axis at $(0, b)$.

In a story, $b$ is the **starting value** (the output when the input is 0) and $m$ is the **rate** (how much the output changes for each extra unit of input). A taxi that charges 3 dollars to start plus 2 dollars per mile has fare $y = 2x + 3$.`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 6],
          curves: [{ expr: "m x + b", label: "y = mx + b", color: 1 }],
          points: [{ x: 0, y: "b", label: "(0, b)", color: 2 }],
          params: [
            { name: "m", label: "m", min: -3, max: 3, step: 0.5, value: 1 },
            { name: "b", label: "b", min: -4, max: 4, step: 1, value: 2 },
          ],
          caption: md`Drag $b$: the line slides up and down without tilting. Drag $m$: the line pivots around $(0, b)$. Try $m = 0$, then a negative $m$.`,
        },
        {
          kind: "example",
          title: "Graphing from the equation",
          problem: md`Graph $y = -\frac{2}{3}x + 4$.`,
          steps: [
            { math: md`b = 4 \;\Rightarrow\; (0, 4)`, note: "Plot the $y$-intercept first." },
            { math: md`m = \frac{-2}{3}`, note: md`Slope $-\frac{2}{3}$ means: for every 3 steps right, go 2 down.` },
            { math: md`(0, 4) \to (3, 2) \to (6, 0)`, note: "Step from the intercept, then draw the line through the points." },
          ],
        },
        {
          kind: "plot",
          x: [-2, 8],
          y: [-3, 7],
          curves: [{ expr: "-2/3x + 4", label: md`y = -\tfrac{2}{3}x + 4`, color: 1 }],
          points: [
            { x: 0, y: 4, label: "(0, 4)", color: 2 },
            { x: 3, y: 2, label: "(3, 2)", color: 3 },
            { x: 6, y: 0, label: "(6, 0)", color: 3 },
          ],
        },
        {
          kind: "example",
          title: "From the slope and a point",
          problem: md`Write the equation of the line with slope 3 that passes through $(2, 1)$.`,
          steps: [
            { math: md`y = 3x + b`, note: "The slope is known. Only $b$ is missing." },
            { math: md`1 = 3(2) + b`, note: "The point is on the line, so its coordinates satisfy the equation." },
            { math: md`b = -5`, note: "Subtract 6 from both sides." },
            { math: md`y = 3x - 5`, note: md`Check with the point: $3(2) - 5 = 1$ ✓.` },
          ],
        },
        {
          kind: "example",
          title: "From two points",
          problem: md`Write the equation of the line through $(1, 4)$ and $(3, 10)$.`,
          steps: [
            { math: md`m = \frac{10 - 4}{3 - 1} = 3`, note: "Slope first." },
            { math: md`4 = 3(1) + b \;\Rightarrow\; b = 1`, note: md`Then substitute either point into $y = 3x + b$.` },
            { math: md`y = 3x + 1`, note: md`Check the other point: $3(3) + 1 = 10$ ✓.` },
          ],
        },
        {
          kind: "text",
          body: md`Read $m$ and $b$ off only when the equation is in exactly the form $y = mx + b$. Rewrite it first if needed:

- $y = 7 - 2x$ is $y = -2x + 7$, so $m = -2$ and $b = 7$.
- $y = \frac{x}{2}$ is $y = \frac{1}{2}x + 0$, so $m = \frac{1}{2}$ and $b = 0$.
- $y = 3$ is $y = 0x + 3$: slope 0, a horizontal line.

A vertical line like $x = 2$ can't be written this way at all. Its slope is undefined, and there's no $y$ in its equation to solve for.`,
        },
        {
          kind: "text",
          body: md`The **$x$-intercept** is where a line crosses the $x$-axis. Every point on the $x$-axis has $y = 0$, so set $y = 0$ and solve. For $y = 2x - 6$, the equation $0 = 2x - 6$ gives $x = 3$, so the line crosses at $(3, 0)$. In a story, the $x$-intercept is often the moment something runs out.`,
        },
        {
          kind: "check",
          prompt: md`Write the equation of the line with slope $-2$ and $y$-intercept 5. Give it in slope-intercept form.`,
          answer: "-2x + 5",
          simplified: true,
          expanded: true,
          explain: md`Put $m = -2$ and $b = 5$ into $y = mx + b$: $y = -2x + 5$.`,
        },
        {
          kind: "check",
          prompt: md`Write the equation of the line through $(2, 3)$ and $(4, 7)$ in slope-intercept form.`,
          answer: "2x - 1",
          simplified: true,
          expanded: true,
          explain: md`$m = \frac{7 - 3}{4 - 2} = 2$. Then $3 = 2(2) + b$ gives $b = -1$, so $y = 2x - 1$.`,
        },
      ],
      practice: [writeSI, xIntercepts, models],
    },
    {
      id: "point-slope-and-standard-form",
      title: "Point-slope and standard form",
      summary: "Two more ways to write the same line: one built from any point and the slope, one with x and y side by side.",
      blocks: [
        {
          kind: "text",
          body: md`Slope-intercept form is built around one special point, the $y$-intercept. Often you know a different point instead. Rather than solving for $b$ every time, you can write the line straight from the point you have.`,
        },
        {
          kind: "why",
          title: "Deriving point-slope form",
          body: md`Suppose a line has slope $m$ and passes through $(x_1, y_1)$. For any other point $(x, y)$ on the line, the slope between the two points is $m$:
$$\frac{y - y_1}{x - x_1} = m.$$
Multiply both sides by $(x - x_1)$:
$$y - y_1 = m(x - x_1).$$
The point $(x_1, y_1)$ itself fits too, since both sides become 0. So this one equation describes exactly the points of the line. It's the same reasoning that gave $y = mx + b$, with $(x_1, y_1)$ in place of $(0, b)$.`,
        },
        {
          kind: "key",
          title: "Point-slope form",
          body: md`The line with slope $m$ through the point $(x_1, y_1)$ is
$$y - y_1 = m(x - x_1), \quad\text{or equivalently}\quad y = y_1 + m(x - x_1).$$
The second version reads like directions: start at height $y_1$, then add $m$ for every unit you move away from $x_1$.`,
        },
        {
          kind: "example",
          title: "Writing and converting",
          problem: md`Write the line with slope $-2$ through $(3, 1)$ in point-slope form, then in slope-intercept form.`,
          steps: [
            { math: md`y - 1 = -2(x - 3)`, note: md`Substitute $m = -2$, $x_1 = 3$, $y_1 = 1$.` },
            { math: md`y - 1 = -2x + 6`, note: "Distribute." },
            { math: md`y = -2x + 7`, note: "Add 1 to both sides. Same line, now with its slope and intercept on display." },
          ],
        },
        {
          kind: "example",
          title: "Watch the signs",
          problem: md`Write the line with slope $\frac{1}{2}$ through $(-4, 5)$ in slope-intercept form.`,
          steps: [
            { math: md`y - 5 = \frac{1}{2}(x - (-4))`, note: "Substitute exactly as the form says." },
            { math: md`y - 5 = \frac{1}{2}(x + 4)`, note: "Subtracting $-4$ is adding 4. A negative coordinate shows up as a plus sign in the bracket." },
            { math: md`y - 5 = \frac{1}{2}x + 2`, note: "Distribute." },
            { math: md`y = \frac{1}{2}x + 7`, note: "Add 5 to both sides." },
          ],
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 6],
          curves: [{ expr: "q + m(x - p)", label: "y = q + m(x - p)", color: 1 }],
          points: [{ x: "p", y: "q", label: "(p, q)", color: 2 }],
          params: [
            { name: "p", label: "p", min: -4, max: 4, step: 1, value: 1 },
            { name: "q", label: "q", min: -4, max: 4, step: 1, value: 2 },
            { name: "m", label: "m", min: -3, max: 3, step: 0.5, value: 1 },
          ],
          caption: md`Move the point $(p, q)$ and change the slope $m$. The line always passes through $(p, q)$: putting $x = p$ makes $m(x - p)$ zero and leaves $y = q$.`,
        },
        {
          kind: "text",
          body: md`A third common form puts $x$ and $y$ on the same side:
$$Ax + By = C.$$
This is **standard form**, usually written with whole numbers $A$, $B$ and $C$. It's natural when a problem is about a fixed total. If adult tickets cost 4 dollars, child tickets cost 2, and a group spent 20 dollars, then $4x + 2y = 20$, where $x$ counts adult tickets and $y$ counts child tickets.`,
        },
        {
          kind: "key",
          title: "Standard form and its intercepts",
          body: md`For a line $Ax + By = C$:

- the $x$-intercept comes from setting $y = 0$,
- the $y$-intercept comes from setting $x = 0$,
- the slope is $-\frac{A}{B}$ (when $B \ne 0$), which you see by solving for $y$.`,
        },
        {
          kind: "why",
          title: "Why setting a variable to 0 finds an intercept",
          body: md`The $x$-axis is itself a line: the set of points with $y = 0$. The $x$-intercept is the point on **both** lines, so its coordinates must satisfy both $Ax + By = C$ and $y = 0$. Substituting $y = 0$ uses both facts at once. The $y$-intercept works the same way with the $y$-axis, the line $x = 0$.

For the slope, solve $Ax + By = C$ for $y$. Subtract $Ax$ to get $By = -Ax + C$, then divide by $B$:
$$y = -\frac{A}{B}x + \frac{C}{B}.$$
That's slope-intercept form, with $m = -\frac{A}{B}$.`,
        },
        {
          kind: "example",
          title: "Intercepts and slope",
          problem: md`Find the intercepts and the slope of $3x + 4y = 12$.`,
          steps: [
            { math: md`3x + 4(0) = 12 \;\Rightarrow\; x = 4`, note: md`Set $y = 0$. The $x$-intercept is $(4, 0)$.` },
            { math: md`3(0) + 4y = 12 \;\Rightarrow\; y = 3`, note: md`Set $x = 0$. The $y$-intercept is $(0, 3)$.` },
            { math: md`m = \frac{0 - 3}{4 - 0} = -\frac{3}{4}`, note: md`The slope from the two intercepts matches $-\frac{A}{B} = -\frac{3}{4}$.` },
          ],
        },
        {
          kind: "plot",
          x: [-2, 6],
          y: [-2, 6],
          curves: [{ expr: "-3/4x + 3", label: "3x + 4y = 12", color: 1 }],
          points: [
            { x: 4, y: 0, label: "(4, 0)", color: 2 },
            { x: 0, y: 3, label: "(0, 3)", color: 3 },
          ],
          caption: "Two intercepts are enough to draw the line.",
        },
        {
          kind: "example",
          title: "Standard form to slope-intercept form",
          problem: md`Write $2x - 5y = 10$ in slope-intercept form.`,
          steps: [
            { math: md`-5y = -2x + 10`, note: md`Subtract $2x$ from both sides.` },
            { math: md`y = \frac{2}{5}x - 2`, note: md`Divide every term by $-5$. The slope is $-\frac{A}{B} = -\frac{2}{-5} = \frac{2}{5}$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the $x$-intercept of $2x - 3y = 12$. Give it as a point $(x, y)$.`,
          answer: "(6, 0)",
          form: "tuple",
          explain: md`Set $y = 0$: $2x = 12$, so $x = 6$. The $x$-intercept is $(6, 0)$.`,
        },
        {
          kind: "check",
          prompt: md`Write the line with slope 4 through $(1, -2)$ in slope-intercept form.`,
          answer: "4x - 6",
          simplified: true,
          expanded: true,
          explain: md`Point-slope: $y + 2 = 4(x - 1)$. Distribute: $y + 2 = 4x - 4$. Subtract 2: $y = 4x - 6$.`,
        },
      ],
      practice: [forms, intercepts],
    },
    {
      id: "parallel-and-perpendicular-lines",
      title: "Parallel and perpendicular lines",
      summary: "Parallel lines share a slope, perpendicular slopes multiply to -1, and why.",
      blocks: [
        {
          kind: "text",
          body: md`Slope captures a line's direction. So questions about direction, like whether two lines run side by side forever or cross at a right angle, turn into questions about slopes.`,
        },
        {
          kind: "key",
          title: "Parallel lines",
          body: md`Two different non-vertical lines are **parallel** exactly when they have the **same slope**. All vertical lines are parallel to each other too.`,
        },
        {
          kind: "why",
          title: "Why equal slopes mean parallel",
          body: md`Take $y = mx + b_1$ and $y = mx + b_2$ with $b_1 \ne b_2$. At every $x$, the vertical gap between them is
$$(mx + b_1) - (mx + b_2) = b_1 - b_2,$$
the same number everywhere. A gap that never changes and isn't 0 means the lines never meet. This is the same thing you saw in Unit 2, where $2x + 3 = 2x + 7$ had no solution.

If the slopes were different, the gap would change by $m_1 - m_2$ for every step in $x$. Sooner or later it would reach 0, and the lines would cross.`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 6],
          curves: [
            { expr: "2x + 1", label: "y = 2x + 1", color: 1 },
            { expr: "2x + b", label: "y = 2x + b", color: 2 },
          ],
          params: [{ name: "b", label: "b", min: -5, max: 5, step: 1, value: -3 }],
          caption: md`Same slope, different intercepts. Slide $b$: the gap changes, but the lines never cross. At $b = 1$ they aren't two lines any more, just one.`,
        },
        {
          kind: "key",
          title: "Perpendicular lines",
          body: md`Two non-vertical lines are **perpendicular** (they meet at a right angle) exactly when their slopes multiply to $-1$:
$$m_1 m_2 = -1, \quad\text{that is,}\quad m_2 = -\frac{1}{m_1}.$$
The perpendicular slope is the **negative reciprocal**: flip the fraction and change its sign. A horizontal line and a vertical line are also perpendicular.`,
        },
        {
          kind: "why",
          title: "Why perpendicular slopes multiply to $-1$",
          body: md`Draw a slope triangle for a line with slope $\frac{a}{b}$: run $b$ to the right, then rise $a$ up. Now rotate the whole picture a quarter turn (90 degrees) counterclockwise around the triangle's starting corner.

- The run pointed right. After the turn it points **up**, so it becomes a rise of $b$.
- The rise pointed up. After the turn it points **left**, so it becomes a run of $-a$.

The turned line has slope $\frac{b}{-a} = -\frac{b}{a}$, and it meets the original line at a right angle, because a quarter turn is a right angle. Multiply the two slopes:
$$\frac{a}{b} \cdot \left(-\frac{b}{a}\right) = -1.$$`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 6],
          curves: [
            { expr: "2/3x + 1", label: md`y = \tfrac{2}{3}x + 1`, color: 1 },
            { expr: "-3/2x + 1", label: md`y = -\tfrac{3}{2}x + 1`, color: 2 },
            { expr: "1", domain: [0, 3], dashed: true, color: 1 },
            { expr: "4", domain: [-2, 0], dashed: true, color: 2 },
          ],
          points: [
            { x: 0, y: 1, label: "(0, 1)", color: 3 },
            { x: 3, y: 3, label: "(3, 3)", color: 1 },
            { x: -2, y: 4, label: "(-2, 4)", color: 2 },
          ],
          caption: md`From $(0, 1)$, the blue line goes 3 right and 2 up to $(3, 3)$. Turn that triangle a quarter turn: 3 up and 2 left reaches $(-2, 4)$ on the orange line. The slopes are $\frac{2}{3}$ and $-\frac{3}{2}$, and their product is $-1$.`,
        },
        {
          kind: "example",
          title: "A parallel line through a point",
          problem: md`Write the equation of the line parallel to $y = 3x - 2$ that passes through $(1, 5)$.`,
          steps: [
            { math: md`m = 3`, note: "Parallel means the same slope." },
            { math: md`y - 5 = 3(x - 1)`, note: "Point-slope form with the given point." },
            { math: md`y = 3x + 2`, note: "Distribute and add 5. A different intercept, the same direction." },
          ],
        },
        {
          kind: "example",
          title: "A perpendicular line through a point",
          problem: md`Write the equation of the line perpendicular to $y = \frac{2}{3}x + 1$ that passes through $(4, -1)$.`,
          steps: [
            { math: md`m = -\frac{3}{2}`, note: md`The negative reciprocal of $\frac{2}{3}$. Check: $\frac{2}{3} \cdot \left(-\frac{3}{2}\right) = -1$.` },
            { math: md`y + 1 = -\frac{3}{2}(x - 4)`, note: md`Point-slope form. $y - (-1)$ is $y + 1$.` },
            { math: md`y + 1 = -\frac{3}{2}x + 6`, note: "Distribute." },
            { math: md`y = -\frac{3}{2}x + 5`, note: "Subtract 1 from both sides." },
          ],
        },
        {
          kind: "text",
          body: md`When a line is given in standard form, find its slope first. The line $2x + 5y = 10$ has slope $-\frac{A}{B} = -\frac{2}{5}$. A parallel line also has slope $-\frac{2}{5}$, and a perpendicular one has slope $\frac{5}{2}$.`,
        },
        {
          kind: "check",
          prompt: md`What is the slope of a line perpendicular to $y = -4x + 1$?`,
          answer: "1/4",
          simplified: true,
          explain: md`The negative reciprocal of $-4$ is $\frac{1}{4}$. Check: $-4 \cdot \frac{1}{4} = -1$.`,
        },
        {
          kind: "check",
          prompt: md`Lines $\ell_1$ and $\ell_2$ have equations $y = 2x + 3$ and $y = -\frac{1}{2}x - 1$. Are they parallel, perpendicular, or neither?`,
          accept: ["perpendicular", "perp"],
          explain: md`The slopes are $2$ and $-\frac{1}{2}$, and $2 \cdot \left(-\frac{1}{2}\right) = -1$. They are perpendicular.`,
        },
      ],
      practice: [slopesPP, linesPP],
    },
  ],
};
