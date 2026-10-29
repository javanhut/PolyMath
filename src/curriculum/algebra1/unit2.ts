import { frac, fracTex, gcd, paren, poly, signed } from "../../math/random";
import { md, type Generator, type Problem, type Unit } from "../types";

export const NO_SOLUTION = ["no solution", "no solutions", "none", "no real solution", "no real solutions"];
export const ALL_REALS = [
  "all real numbers",
  "all reals",
  "all numbers",
  "any number",
  "every number",
  "infinitely many",
  "infinitely many solutions",
  "infinite",
  "identity",
];

const SPECIAL_HINT = md`If no number works, type **no solution**. If every number works, type **all real numbers**.`;

// ── Practice generators ─────────────────────────────────────────────────────

const oneStep: Generator = (r) => {
  const x = r.nonzero(-12, 12);
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = r.nonzero(-15, 15);
    return {
      prompt: md`Solve $${poly([[1, "x"], [a, ""]])} = ${x + a}$.`,
      answer: String(x),
      hint: md`$x$ had ${paren(a)} added to it. Undo that on both sides.`,
      solution: [
        { math: md`x ${signed(a)} ${signed(-a)} = ${x + a} ${signed(-a)}`, note: md`${a > 0 ? "Subtract" : "Add"} ${Math.abs(a)} on both sides.` },
        { math: md`x = ${x}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(2, 15);
    return {
      prompt: md`Solve $x - ${a} = ${x - a}$.`,
      answer: String(x),
      hint: md`Undo the subtraction: add ${a} to both sides.`,
      solution: [
        { math: md`x - ${a} + ${a} = ${x - a} + ${a}`, note: "Add to both sides." },
        { math: md`x = ${x}`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const a = r.coef(-9, 9);
    return {
      prompt: md`Solve $${a}x = ${a * x}$.`,
      answer: String(x),
      hint: md`$x$ was multiplied by ${a}. Divide both sides by ${a}.`,
      solution: [
        { math: md`\frac{${a}x}{${a}} = \frac{${a * x}}{${a}}`, note: "Divide both sides by the coefficient." },
        { math: md`x = ${x}`, note: "" },
      ],
    };
  }
  const a = r.coef(2, 9);
  return {
    prompt: md`Solve $\frac{x}{${a}} = ${x}$.`,
    answer: String(x * a),
    hint: md`$x$ was divided by ${a}. Multiply both sides by ${a}.`,
    solution: [
      { math: md`${paren(a)} \cdot \frac{x}{${a}} = ${paren(a)} \cdot ${paren(x)}`, note: "Multiply both sides." },
      { math: md`x = ${x * a}`, note: "" },
    ],
  };
};

const twoStep: Generator = (r) => {
  const x = r.nonzero(-10, 10);
  const kind = r.int(0, 2);
  if (kind === 0) {
    const a = r.coef(-8, 8);
    const b = r.nonzero(-15, 15);
    const c = a * x + b;
    return {
      prompt: md`Solve $${poly([[a, "x"], [b, ""]])} = ${c}$.`,
      answer: String(x),
      hint: "Undo in reverse order: first the addition or subtraction, then the multiplication.",
      solution: [
        { math: md`${a}x = ${c - b}`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} on both sides.` },
        { math: md`x = ${x}`, note: md`Divide both sides by ${a}.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.coef(2, 8);
    const b = r.int(1, 20);
    const c = b - a * x;
    return {
      prompt: md`Solve $${b} - ${a}x = ${c}$.`,
      answer: String(x),
      hint: md`The minus sign belongs to the $${a}x$: the coefficient is $-${a}$.`,
      solution: [
        { math: md`-${a}x = ${c - b}`, note: md`Subtract ${b} from both sides.` },
        { math: md`x = ${x}`, note: md`Divide both sides by $-${a}$.` },
      ],
    };
  }
  const a = r.coef(2, 6);
  const b = r.nonzero(-10, 10);
  const xm = x * a;
  return {
    prompt: md`Solve $\frac{x}{${a}} ${signed(b)} = ${x + b}$.`,
    answer: String(xm),
    hint: md`Undo the ${b > 0 ? "addition" : "subtraction"} first, then multiply by ${a}.`,
    solution: [
      { math: md`\frac{x}{${a}} = ${x}`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} on both sides.` },
      { math: md`x = ${xm}`, note: md`Multiply both sides by ${a}.` },
    ],
  };
};

const bothSides: Generator = (r) => {
  const x = r.nonzero(-9, 9);
  if (r.next() < 0.5) {
    const a = r.nonzero(-9, 9);
    let c = r.nonzero(-9, 9);
    while (c === a) c = r.nonzero(-9, 9);
    const b = r.nonzero(-12, 12);
    const d = (a - c) * x + b;
    return {
      prompt: md`Solve $${poly([[a, "x"], [b, ""]])} = ${poly([[c, "x"], [d, ""]])}$.`,
      answer: String(x),
      hint: "Move all the x-terms to one side and all the constants to the other.",
      solution: [
        { math: md`${poly([[a - c, "x"], [b, ""]])} = ${d}`, note: md`${c > 0 ? "Subtract" : "Add"} $${poly([[Math.abs(c), "x"]])}$ on both sides.` },
        { math: md`${poly([[a - c, "x"]])} = ${d - b}`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)} on both sides.` },
        { math: md`x = ${x}`, note: a - c === 1 ? "" : md`Divide by ${a - c}.` },
      ],
    };
  }
  const a = r.coef(2, 6);
  const b = r.nonzero(-6, 6);
  let c = r.nonzero(-7, 7);
  while (c === a) c = r.nonzero(-7, 7);
  const d = a * (x + b) - c * x;
  return {
    prompt: md`Solve $${a}(${poly([[1, "x"], [b, ""]])}) = ${poly([[c, "x"], [d, ""]])}$.`,
    answer: String(x),
    hint: "Distribute first so each side is a simple sum, then collect the x-terms.",
    solution: [
      { math: md`${poly([[a, "x"], [a * b, ""]])} = ${poly([[c, "x"], [d, ""]])}`, note: "Distribute." },
      { math: md`${poly([[a - c, "x"]])} = ${d - a * b}`, note: "Collect x-terms on the left and constants on the right." },
      { math: md`x = ${x}`, note: a - c === 1 ? "" : md`Divide by ${a - c}.` },
    ],
  };
};

const specialCases: Generator = (r) => {
  const kind = r.int(0, 2);
  const a = r.coef(2, 7);
  const m = r.nonzero(-6, 6);
  if (kind === 0) {
    let d = r.nonzero(-12, 12);
    while (d === a * m) d = r.nonzero(-12, 12);
    return {
      prompt: md`Solve $${a}(${poly([[1, "x"], [m, ""]])}) = ${poly([[a, "x"], [d, ""]])}$. ${SPECIAL_HINT}`,
      accept: NO_SOLUTION,
      hint: "Distribute, then try to collect the x-terms. What's left?",
      solution: [
        { math: md`${poly([[a, "x"], [a * m, ""]])} = ${poly([[a, "x"], [d, ""]])}`, note: "Distribute." },
        { math: md`${a * m} = ${d}`, note: md`Subtract $${a}x$ from both sides. The x's are gone, and the statement left is false.` },
        { math: md`\text{no solution}`, note: "Both sides grow at the same rate but start at different values, so they are never equal." },
      ],
    };
  }
  if (kind === 1) {
    let b = r.nonzero(-5, 5);
    while (b === a * m) b = r.nonzero(-5, 5);
    const k = a * m - b;
    return {
      prompt: md`Solve $${a}(${poly([[1, "x"], [m, ""]])}) = ${poly([[a - 1, "x"], [b, ""]])} + x ${signed(k)}$. ${SPECIAL_HINT}`,
      accept: ALL_REALS,
      hint: "Simplify each side completely before doing anything else.",
      solution: [
        { math: md`${poly([[a, "x"], [a * m, ""]])} = ${poly([[a, "x"], [a * m, ""]])}`, note: "Distribute on the left, combine like terms on the right." },
        { math: md`${a * m} = ${a * m}`, note: md`Subtract $${a}x$: what's left is always true.` },
        { math: md`\text{all real numbers}`, note: "The two sides are the same expression written two ways." },
      ],
    };
  }
  const x = r.nonzero(-6, 6);
  const c = a + r.pick([1, -1, 2]);
  const d = a * (x + m) - c * x;
  return {
    prompt: md`Solve $${a}(${poly([[1, "x"], [m, ""]])}) = ${poly([[c, "x"], [d, ""]])}$. ${SPECIAL_HINT}`,
    answer: String(x),
    hint: "Distribute, then collect the x-terms.",
    solution: [
      { math: md`${poly([[a, "x"], [a * m, ""]])} = ${poly([[c, "x"], [d, ""]])}`, note: "Distribute." },
      { math: md`${poly([[a - c, "x"]])} = ${d - a * m}`, note: "Collect terms. The x's don't cancel, so there's exactly one solution." },
      { math: md`x = ${x}`, note: "" },
    ],
  };
};

const lcm = (a: number, b: number) => (a * b) / gcd(a, b);

const fractionEquations: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const a = r.int(2, 6);
    let b = r.int(2, 6);
    while (b === a) b = r.int(2, 6);
    const L = lcm(a, b);
    const x = L * r.nonzero(-4, 4);
    const c = x / a + x / b;
    return {
      prompt: md`Solve $\frac{x}{${a}} + \frac{x}{${b}} = ${c}$.`,
      answer: String(x),
      hint: md`Multiply both sides by ${L}, a number both ${a} and ${b} divide into.`,
      solution: [
        { math: md`${L} \cdot \frac{x}{${a}} + ${L} \cdot \frac{x}{${b}} = ${L} \cdot ${paren(c)}`, note: md`Multiply **every** term by the LCD, ${L}.` },
        { math: md`${L / a}x + ${L / b}x = ${L * c}`, note: "The denominators cancel." },
        { math: md`${L / a + L / b}x = ${L * c}`, note: "Combine like terms." },
        { math: md`x = ${x}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const a = r.coef(2, 7);
    const b = r.nonzero(-9, 9);
    const c = r.nonzero(-6, 6);
    const x = a * c - b;
    return {
      prompt: md`Solve $\frac{${poly([[1, "x"], [b, ""]])}}{${a}} = ${c}$.`,
      answer: String(x),
      hint: "The fraction bar groups the whole top. Multiply both sides by the denominator first.",
      solution: [
        { math: md`${poly([[1, "x"], [b, ""]])} = ${a * c}`, note: md`Multiply both sides by ${a}.` },
        { math: md`x = ${x}`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)}.` },
      ],
    };
  }
  let a = r.int(2, 9);
  let b = r.int(2, 9);
  while (gcd(a, b) !== 1) b = r.int(2, 9);
  const c = r.nonzero(-9, 9);
  if (r.next() < 0.5) a = -a;
  return {
    prompt: md`Solve $${fracTex(a, b)}x = ${c}$. Give an exact answer.`,
    answer: frac(b * c, a),
    simplified: true,
    hint: md`Multiply both sides by the reciprocal, $${fracTex(b, a)}$.`,
    solution: [
      { math: md`${fracTex(b, a)} \cdot ${fracTex(a, b)}x = ${fracTex(b, a)} \cdot ${paren(c)}`, note: "A number times its reciprocal is 1, which leaves x alone." },
      { math: md`x = ${fracTex(b * c, a)}`, note: "Reduce the fraction if possible." },
    ],
  };
};

const FORMULAS: { eq: string; solveFor: string; answer: string; steps: [string, string][] }[] = [
  { eq: "d = rt", solveFor: "t", answer: "d/r", steps: [[md`\frac{d}{r} = t`, "Divide both sides by r."]] },
  { eq: "A = lw", solveFor: "w", answer: "A/l", steps: [[md`\frac{A}{l} = w`, "Divide both sides by l."]] },
  { eq: "V = lwh", solveFor: "h", answer: "V/(lw)", steps: [[md`\frac{V}{lw} = h`, "Divide both sides by lw."]] },
  { eq: "I = Prt", solveFor: "r", answer: "I/(Pt)", steps: [[md`\frac{I}{Pt} = r`, "Divide both sides by Pt."]] },
  { eq: md`C = 2\pi r`, solveFor: "r", answer: "C/(2pi)", steps: [[md`\frac{C}{2\pi} = r`, md`Divide both sides by $2\pi$, which is just a number.`]] },
  { eq: md`A = \frac{1}{2}bh`, solveFor: "h", answer: "2A/b", steps: [[md`2A = bh`, "Multiply both sides by 2."], [md`\frac{2A}{b} = h`, "Divide both sides by b."]] },
  {
    eq: "P = 2l + 2w",
    solveFor: "w",
    answer: "(P - 2l)/2",
    steps: [
      [md`P - 2l = 2w`, md`Subtract $2l$ from both sides.`],
      [md`\frac{P - 2l}{2} = w`, "Divide both sides by 2."],
    ],
  },
  {
    eq: "y = mx + b",
    solveFor: "x",
    answer: "(y - b)/m",
    steps: [
      [md`y - b = mx`, "Subtract b from both sides."],
      [md`\frac{y - b}{m} = x`, "Divide both sides by m."],
    ],
  },
  {
    eq: md`F = \frac{9}{5}C + 32`,
    solveFor: "C",
    answer: "5(F - 32)/9",
    steps: [
      [md`F - 32 = \frac{9}{5}C`, "Subtract 32 from both sides."],
      [md`\frac{5}{9}(F - 32) = C`, md`Multiply both sides by the reciprocal, $\frac{5}{9}$.`],
    ],
  },
  {
    eq: "A = P + Prt",
    solveFor: "t",
    answer: "(A - P)/(Pr)",
    steps: [
      [md`A - P = Prt`, "Subtract P from both sides."],
      [md`\frac{A - P}{Pr} = t`, "Divide both sides by Pr."],
    ],
  },
  {
    eq: "ax + b = c",
    solveFor: "x",
    answer: "(c - b)/a",
    steps: [
      [md`ax = c - b`, "Subtract b."],
      [md`x = \frac{c - b}{a}`, "Divide by a. This one formula solves every two-step equation."],
    ],
  },
];

const literalEquations: Generator = (r): Problem => {
  if (r.next() < 0.35) {
    const a = r.nonzero(-6, 6);
    const b = r.coef(2, 5) * r.sign();
    const c = r.nonzero(-12, 12);
    return {
      prompt: md`Solve $${poly([[a, "x"], [b, "y"]])} = ${c}$ for $y$.`,
      answer: `(${c} - ${paren(a)}x)/${paren(b)}`,
      hint: "Treat x like a number you don't know: move its term to the other side, then divide.",
      solution: [
        { math: md`${b}y = ${poly([[-a, "x"], [c, ""]])}`, note: md`${a > 0 ? "Subtract" : "Add"} $${poly([[Math.abs(a), "x"]])}$ on both sides.` },
        { math: md`y = \frac{${poly([[-a, "x"], [c, ""]])}}{${b}}`, note: md`Divide by ${b}. Any equivalent form is fine.` },
      ],
    };
  }
  const f = r.pick(FORMULAS);
  return {
    prompt: md`Solve $${f.eq}$ for $${f.solveFor}$.`,
    answer: f.answer,
    hint: md`Find what's being done to $${f.solveFor}$, and undo it in reverse order. The other letters are just numbers you don't know. (Letters are case-sensitive.)`,
    solution: f.steps.map(([math, note]) => ({ math, note })),
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit2: Unit = {
  title: "Solving Linear Equations",
  lessons: [
    {
      id: "what-an-equation-is",
      title: "What an equation is",
      summary: "Equations as claims, and the one rule behind every solving step.",
      blocks: [
        {
          kind: "text",
          body: md`An expression has a value. An **equation** is a sentence. $2x + 1 = 7$ claims "two times $x$, plus one, equals seven". For most values of $x$ that claim is false. For $x = 3$ it is true.

A **solution** is a value that makes the equation true. **Solving** means finding all of them.`,
        },
        {
          kind: "text",
          body: md`You could guess and check, but that doesn't scale. Instead, we transform the equation step by step into one so simple that the answer can be read off, like $x = 3$. Every step has to keep the solutions exactly the same. One rule guarantees that:`,
        },
        {
          kind: "key",
          title: "Properties of equality",
          body: md`If $a = b$, then for any number $c$:

- $a + c = b + c$ and $a - c = b - c$
- $ac = bc$, and $\frac{a}{c} = \frac{b}{c}$ when $c \ne 0$

Do the same thing to both sides, and a true equation stays true.`,
        },
        {
          kind: "why",
          title: "Why does doing the same thing to both sides work?",
          body: md`If $a = b$, then $a$ and $b$ are two names for **one** number. Add $c$ to that number and you get one result, whichever name you used. The equation can't become false, because there was only ever one number.`,
        },
        {
          kind: "text",
          body: md`A balance scale shows the same idea. Each box weighs $x$, and each small block weighs 1. Try the steps, and also try changing only one side:`,
        },
        { kind: "widget", widget: "balance" },
        {
          kind: "text",
          body: md`So the strategy is: look at what has been done to $x$, and **undo** it. In $x + 5 = 12$, 5 was added to $x$, so subtract 5 from both sides: $x = 7$.`,
        },
        {
          kind: "example",
          title: "Undoing a division",
          problem: md`Solve $\frac{x}{4} = -3$.`,
          steps: [
            { math: md`4 \cdot \frac{x}{4} = 4 \cdot (-3)`, note: "x was divided by 4, so multiply both sides by 4." },
            { math: md`x = -12`, note: "" },
            { math: md`\frac{-12}{4} = -3 \;\checkmark`, note: "Check by substituting into the **original** equation." },
          ],
        },
        {
          kind: "why",
          title: "Why is dividing by zero forbidden here too?",
          body: md`Multiplying both sides by $0$ turns *any* equation into $0 = 0$, even a false one like $3 = 5$. That step destroys information, so nothing can undo it, and "dividing by 0" has no meaning. This is the one exception in the properties of equality.`,
        },
        {
          kind: "check",
          prompt: md`Solve $-7x = 21$.`,
          answer: "-3",
          explain: md`Divide both sides by $-7$: $x = \frac{21}{-7} = -3$. Check: $-7(-3) = 21$ ✓.`,
        },
      ],
      practice: [oneStep],
    },
    {
      id: "two-step-equations",
      title: "Two-step equations",
      summary: "Undoing operations in reverse order.",
      blocks: [
        {
          kind: "text",
          body: md`In $3x + 2 = 11$, two things happened to $x$: it was multiplied by 3, *then* 2 was added. To undo them, go in reverse order. Subtract 2 first, then divide by 3.

It's like socks and shoes. You put socks on first and shoes second, but you take shoes off first.`,
        },
        {
          kind: "why",
          title: "Why reverse order?",
          body: md`The order of operations built the expression: multiply first, then add. The **last** operation applied is the outermost layer, the one you can peel off directly.

You *could* divide first, but then you must divide every term: $\frac{3x + 2}{3} = x + \frac{2}{3}$. That's legal, just messier. Reverse order keeps the numbers clean.`,
        },
        {
          kind: "example",
          title: "The basic case",
          problem: md`Solve $3x + 2 = 11$.`,
          steps: [
            { math: md`3x = 9`, note: "Subtract 2 from both sides." },
            { math: md`x = 3`, note: "Divide both sides by 3." },
            { math: md`3(3) + 2 = 11 \;\checkmark`, note: "Check." },
          ],
        },
        {
          kind: "example",
          title: "A negative coefficient",
          problem: md`Solve $5 - 2x = 17$.`,
          steps: [
            { math: md`-2x = 12`, note: md`Subtract 5. The minus belongs to $2x$, so the coefficient is $-2$.` },
            { math: md`x = -6`, note: md`Divide by $-2$.` },
            { math: md`5 - 2(-6) = 5 + 12 = 17 \;\checkmark`, note: "Check." },
          ],
        },
        {
          kind: "example",
          title: "With a division",
          problem: md`Solve $\frac{x}{3} - 4 = 2$.`,
          steps: [
            { math: md`\frac{x}{3} = 6`, note: "Add 4." },
            { math: md`x = 18`, note: "Multiply by 3." },
          ],
        },
        {
          kind: "check",
          prompt: md`Solve $4x - 7 = 13$.`,
          answer: "5",
          explain: md`Add 7: $4x = 20$. Divide by 4: $x = 5$.`,
        },
      ],
      practice: [twoStep],
    },
    {
      id: "variables-on-both-sides",
      title: "Variables on both sides",
      summary: "Collecting terms, plus equations with no solution or every solution.",
      blocks: [
        {
          kind: "text",
          body: md`In $5x - 3 = 2x + 9$ the unknown is on both sides. The goal is to collect all the $x$-terms on one side. Subtracting $2x$ from both sides is allowed: $2x$ is a number, just one we don't know yet, and the properties of equality work for **any** number.`,
        },
        {
          kind: "example",
          title: "Collecting terms",
          problem: md`Solve $5x - 3 = 2x + 9$.`,
          steps: [
            { math: md`3x - 3 = 9`, note: md`Subtract $2x$ from both sides.` },
            { math: md`3x = 12`, note: "Add 3." },
            { math: md`x = 4`, note: "Divide by 3." },
            { math: md`5(4) - 3 = 17 = 2(4) + 9 \;\checkmark`, note: "Check." },
          ],
        },
        {
          kind: "example",
          title: "Distribute first",
          problem: md`Solve $3(x - 4) = 2(x + 1) - 5$.`,
          steps: [
            { math: md`3x - 12 = 2x + 2 - 5`, note: "Distribute on both sides." },
            { math: md`3x - 12 = 2x - 3`, note: "Combine like terms." },
            { math: md`x - 12 = -3`, note: md`Subtract $2x$.` },
            { math: md`x = 9`, note: "Add 12." },
          ],
        },
        {
          kind: "key",
          title: "A strategy that always works",
          body: md`- Simplify each side: distribute, combine like terms.
- Collect the variable terms on one side.
- Collect the constants on the other side.
- Divide by the coefficient.
- Check in the original equation.`,
        },
        {
          kind: "text",
          body: md`**Two special cases.** Solve $2x + 3 = 2x + 7$. Subtracting $2x$ leaves $3 = 7$, which is false no matter what $x$ is. There is **no solution**.

Solve $2(x + 3) = 2x + 6$. Subtracting $2x$ leaves $6 = 6$, which is true no matter what $x$ is. **Every real number** is a solution. An equation like this is called an *identity*.`,
        },
        {
          kind: "why",
          title: "Why do these happen?",
          body: md`Think of each side as a quantity that changes as $x$ changes. $2x + 3$ and $2x + 7$ grow at exactly the same rate (2 per step) but start 4 apart, so they are never equal. In the identity, the two sides are the same expression written two ways, so they are always equal. When the $x$-terms cancel, the variable has disappeared and what remains is a plain statement, either true or false.`,
        },
        {
          kind: "check",
          prompt: md`Solve $3x + 5 = 3x - 1$. If no number works, type **no solution**; if every number works, type **all real numbers**.`,
          accept: NO_SOLUTION,
          explain: md`Subtracting $3x$ leaves $5 = -1$, which is false. No solution.`,
        },
        {
          kind: "check",
          prompt: md`Solve $7x - 4 = 3x + 8$.`,
          answer: "3",
          explain: md`Subtract $3x$: $4x - 4 = 8$. Add 4: $4x = 12$. So $x = 3$.`,
        },
      ],
      practice: [bothSides, specialCases],
    },
    {
      id: "fractions-in-equations",
      title: "Fractions in equations",
      summary: "Clearing denominators so fractions disappear.",
      blocks: [
        {
          kind: "text",
          body: md`You can solve $\frac{x}{3} + \frac{x}{4} = 7$ by working with fractions directly. There's a cleaner move: multiply both sides by a number that every denominator divides into, the **least common denominator** (LCD). Here that's 12.`,
        },
        {
          kind: "why",
          title: "Why are we allowed to do that?",
          body: md`It's the multiplication property of equality: multiply both sides by 12. The distributive property then says **each** term on a side gets multiplied:

$$12 \cdot \frac{x}{3} + 12 \cdot \frac{x}{4} = 12 \cdot 7 \;\Rightarrow\; 4x + 3x = 84 \;\Rightarrow\; x = 12.$$

No new rule is needed, only the two you already know.`,
        },
        {
          kind: "example",
          title: "Grouped numerators",
          problem: md`Solve $\frac{x + 1}{2} = \frac{x - 3}{5} + 2$.`,
          steps: [
            { math: md`5(x + 1) = 2(x - 3) + 20`, note: "Multiply every term by 10. The fraction bar groups the numerator, so keep the parentheses." },
            { math: md`5x + 5 = 2x + 14`, note: "Distribute and combine." },
            { math: md`3x = 9 \Rightarrow x = 3`, note: md`Subtract $2x$, subtract 5, divide by 3.` },
            { math: md`\frac{4}{2} = 2 = \frac{0}{5} + 2 \;\checkmark`, note: "Check." },
          ],
        },
        {
          kind: "text",
          body: md`Decimals work the same way, since they are fractions with denominators 10, 100, and so on. For $0.2x + 1.5 = 0.7x - 1$, multiply by 10: $2x + 15 = 7x - 10$, so $25 = 5x$ and $x = 5$.

Answers can be fractions. Give them exactly: type **7/3** rather than 2.33.`,
        },
        {
          kind: "check",
          prompt: md`Solve $\frac{x}{2} + \frac{x}{3} = 10$.`,
          answer: "12",
          explain: md`Multiply by 6: $3x + 2x = 60$, so $5x = 60$ and $x = 12$.`,
        },
      ],
      practice: [fractionEquations],
    },
    {
      id: "formulas-and-literal-equations",
      title: "Formulas and literal equations",
      summary: "Solving for one letter in terms of the others.",
      blocks: [
        {
          kind: "text",
          body: md`A **literal equation** contains several letters, like $d = rt$ (distance = rate × time). Solving for one letter means isolating it, using exactly the same moves as before. The only difference is that you can't combine the other letters into a single number.`,
        },
        {
          kind: "example",
          title: "Perimeter of a rectangle",
          problem: md`Solve $P = 2l + 2w$ for $w$.`,
          steps: [
            { math: md`P - 2l = 2w`, note: md`$w$ was doubled, then $2l$ was added. Undo the addition first.` },
            { math: md`w = \frac{P - 2l}{2}`, note: "Divide both sides by 2." },
          ],
        },
        {
          kind: "example",
          title: "Fahrenheit to Celsius",
          problem: md`Solve $F = \frac{9}{5}C + 32$ for $C$.`,
          steps: [
            { math: md`F - 32 = \frac{9}{5}C`, note: "Subtract 32." },
            { math: md`C = \frac{5}{9}(F - 32)`, note: md`Multiply by the reciprocal $\frac{5}{9}$.` },
          ],
        },
        {
          kind: "why",
          title: "Why bother solving with letters?",
          body: md`Solving $ax + b = c$ for $x$ gives

$$x = \frac{c - b}{a} \quad (a \ne 0).$$

That single line solves **every** two-step equation that will ever exist. Instead of answering one question, you've answered all of them at once, which is the whole point of algebra. The quadratic formula you'll meet later is the same idea for a harder family of equations.`,
        },
        {
          kind: "check",
          prompt: md`Solve $A = \frac{1}{2}bh$ for $h$.`,
          answer: "2A/b",
          explain: md`Multiply by 2: $2A = bh$. Divide by $b$: $h = \frac{2A}{b}$.`,
        },
      ],
      practice: [literalEquations],
    },
  ],
};
