import { gcd, paren, poly, signed } from "../../math/random";
import { md, type Generator, type Problem, type Step, type Unit } from "../types";
import { NO_SOLUTION } from "./unit2";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Radicands with no perfect-square factor, so k√m is already simplest form. */
const SQUAREFREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15];
const SMALL_SQUAREFREE = [2, 3, 5, 6, 7];

/** Write n = k²m with k as large as possible. Returns [k, m]. */
function splitSquare(n: number): [number, number] {
  let k = 1;
  for (let j = 2; j * j <= n; j++) if (n % (j * j) === 0) k = j;
  return [k, n / (k * k)];
}

/**
 * A sum of terms c√m, where m = 1 means a plain number. LaTeX by default,
 * answer text ("3sqrt(2) - 4") with tex = false.
 */
function rad(terms: [number, number][], tex = true): string {
  return poly(terms.map(([c, m]) => [c, m === 1 ? "" : tex ? `\\sqrt{${m}}` : `sqrt(${m})`]));
}

/** c√m divided by d, reduced, as [answer text, LaTeX]. */
function radOver(c: number, m: number, d: number): [string, string] {
  const g = gcd(c, d);
  const [n, den] = [c / g, d / g];
  if (den === 1) return [rad([[n, m]], false), rad([[n, m]])];
  return [`${rad([[n, m]], false)}/${den}`, md`\frac{${rad([[n, m]])}}{${den}}`];
}

/** (x - p)(x - q) written by hand: x(x - 3) rather than (x)(x - 3). */
function factorPair(p: number, q: number): string {
  const f = (v: number) => poly([[1, "x"], [-v, ""]]);
  if (p === 0) return `x(${f(q)})`;
  if (q === 0) return `x(${f(p)})`;
  return `(${f(p)})(${f(q)})`;
}

const pm = (s: number) => (s > 0 ? "+" : "-");

const SET_NOTE = md`Give all solutions, separated by commas. If there are none, type **no solution**.`;

/** A check line for one candidate: does √(radicand) really equal the other side? */
function checkLine(v: number, radicand: number, side: number, sideName = "right side"): Step {
  const root = Math.sqrt(radicand);
  if (radicand < 0) {
    return { math: md`x = ${v}: \quad \sqrt{${radicand}}`, note: md`The radicand is negative, so the square root isn't a real number. $x = ${v}$ is **extraneous**.` };
  }
  if (root === side) return { math: md`x = ${v}: \quad \sqrt{${radicand}} = ${root} \;\checkmark`, note: md`The ${sideName} is ${side} too. It works.` };
  return {
    math: md`x = ${v}: \quad \sqrt{${radicand}} = ${root} \ne ${side}`,
    note: md`The square root is ${root}, but the ${sideName} is ${side}. $x = ${v}$ is **extraneous**.`,
  };
}

// ── Lesson 1 practice ───────────────────────────────────────────────────────

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [6, 8, 10],
  [5, 12, 13],
  [8, 15, 17],
  [9, 12, 15],
  [12, 16, 20],
];

const rootValues: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind <= 1) {
    const n = r.pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 30]);
    const neg = kind === 1;
    const steps: Step[] = [
      { math: md`${n}^2 = ${n * n}`, note: md`${n} is nonnegative, and its square is ${n * n}.` },
      { math: md`\sqrt{${n * n}} = ${n}`, note: "So it is the square root." },
    ];
    if (neg) steps.push({ math: md`-\sqrt{${n * n}} = -${n}`, note: "The minus sign outside takes the opposite. The square root itself is still positive." });
    return {
      prompt: md`Evaluate $${neg ? "-" : ""}\sqrt{${n * n}}$.`,
      answer: String(neg ? -n : n),
      simplified: true,
      hint: neg ? md`The minus sign is outside the root. Find $\sqrt{${n * n}}$ first, then take the opposite.` : md`Which nonnegative number times itself gives ${n * n}?`,
      solution: steps,
    };
  }
  if (kind <= 3) {
    const [a, b, c] = r.pick(TRIPLES);
    if (kind === 2) {
      return {
        prompt: md`Evaluate $\sqrt{${a * a} + ${b * b}}$.`,
        answer: String(c),
        simplified: true,
        hint: "The radical is a grouping symbol, like parentheses. Add first, then take the square root.",
        solution: [
          { math: md`\sqrt{${a * a + b * b}}`, note: "Work out the inside first." },
          { math: String(c), note: md`$${c}^2 = ${c * c}$. Notice this is **not** $\sqrt{${a * a}} + \sqrt{${b * b}} = ${a + b}$.` },
        ],
      };
    }
    return {
      prompt: md`Evaluate $\sqrt{${a * a}} + \sqrt{${b * b}}$.`,
      answer: String(a + b),
      simplified: true,
      hint: "Here there are two separate roots. Take each one, then add.",
      solution: [
        { math: md`${a} + ${b}`, note: md`$\sqrt{${a * a}} = ${a}$ and $\sqrt{${b * b}} = ${b}$.` },
        { math: String(a + b), note: md`Compare $\sqrt{${a * a} + ${b * b}} = ${c}$: adding inside the root gives a different answer.` },
      ],
    };
  }
  const a = r.pick([1, 1, 2]);
  const p = r.int(-5, 5);
  let q = r.int(-5, 5);
  while (q === p) q = r.int(-5, 5);
  const b = -a * (p + q);
  const c = a * p * q;
  const disc = b * b - 4 * a * c;
  const value = Math.abs(a * (p - q));
  return {
    prompt: md`Evaluate $\sqrt{b^2 - 4ac}$ when $a = ${a}$, $b = ${b}$, and $c = ${c}$.`,
    answer: String(value),
    simplified: true,
    hint: "This is the part of the quadratic formula under the root. Work out everything inside first.",
    solution: [
      { math: md`\sqrt{${paren(b)}^2 - 4(${a})(${c})}`, note: "Substitute, in parentheses." },
      { math: md`\sqrt{${b * b} ${signed(-4 * a * c)}}`, note: "Square, then multiply." },
      { math: md`\sqrt{${disc}} = ${value}`, note: md`$${value}^2 = ${disc}$.` },
    ],
  };
};

const simplifyRoot: Generator = (r) => {
  const kind = r.int(0, 2);
  const k = kind === 2 ? r.int(5, 10) : r.int(2, 4);
  const m = kind === 2 ? r.pick(SMALL_SQUAREFREE) : r.pick(SQUAREFREE);
  const n = k * k * m;
  const c = kind === 1 ? r.coef(-5, 5) : 1;
  const steps: Step[] = [
    { math: md`\sqrt{${n}} = \sqrt{${k * k} \cdot ${m}}`, note: md`$${k * k} = ${k}^2$ is the largest perfect square that divides ${n}.` },
    { math: md`= \sqrt{${k * k}} \cdot \sqrt{${m}} = ${k}\sqrt{${m}}`, note: md`Split with the product rule. ${m} has no square factor left, so the root is done.` },
  ];
  if (c !== 1) steps.push({ math: md`${c} \cdot ${k}\sqrt{${m}} = ${rad([[c * k, m]])}`, note: "Multiply the number in front by what came out of the root." });
  return {
    prompt: md`Simplify $${c === 1 ? "" : c}\sqrt{${n}}$.`,
    answer: rad([[c * k, m]], false),
    simplified: true,
    hint: md`Find the largest perfect square that divides ${n}. Try 100, 81, 64, 49, 36, 25, 16, 9, 4, from the top down.`,
    solution: steps,
  };
};

const rootFraction: Generator = (r) => {
  const d = r.pick([2, 3]);
  const j = r.int(1, 2);
  const k = d * j;
  const m = r.pick(SMALL_SQUAREFREE);
  const n = k * k * m;
  if (r.next() < 0.3) {
    return {
      prompt: md`Simplify $\frac{\sqrt{${n}}}{${d}}$.`,
      answer: rad([[j, m]], false),
      simplified: true,
      hint: "Simplify the square root first, then see what cancels.",
      solution: [
        { math: md`\frac{${k}\sqrt{${m}}}{${d}}`, note: md`$\sqrt{${n}} = \sqrt{${k * k}}\sqrt{${m}} = ${k}\sqrt{${m}}$.` },
        { math: rad([[j, m]]), note: md`$\frac{${k}}{${d}} = ${j}$.` },
      ],
    };
  }
  const i = r.nonzero(-4, 4);
  const b = d * i;
  const s = r.sign();
  const ans = rad([[i, 1], [s * j, m]], false);
  return {
    prompt: md`Simplify $\frac{${b} ${pm(s)} \sqrt{${n}}}{${d}}$.`,
    answer: ans,
    simplified: true,
    hint: md`Simplify $\sqrt{${n}}$ first. Then check whether ${d} divides **every** term on top.`,
    solution: [
      { math: md`\frac{${b} ${pm(s)} ${k}\sqrt{${m}}}{${d}}`, note: md`$\sqrt{${n}} = ${k}\sqrt{${m}}$.` },
      { math: md`\frac{${b}}{${d}} ${pm(s)} \frac{${k}\sqrt{${m}}}{${d}}`, note: md`The fraction bar divides the whole top, so each term is divided by ${d}. This is the distributive property.` },
      { math: rad([[i, 1], [s * j, m]]), note: "Divide each term." },
    ],
  };
};

// ── Lesson 2 practice ───────────────────────────────────────────────────────

const addRadicals: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const m = r.pick(SQUAREFREE);
    const a = r.nonzero(-9, 9);
    let b = r.nonzero(-9, 9);
    while (a + b === 0) b = r.nonzero(-9, 9);
    return {
      prompt: md`Simplify $${rad([[a, m], [b, m]])}$.`,
      answer: rad([[a + b, m]], false),
      simplified: true,
      hint: md`These are like radicals: both are a number of $\sqrt{${m}}$'s. Add the coefficients.`,
      solution: [
        { math: md`(${a} ${signed(b)})\sqrt{${m}}`, note: md`Distributive property backwards, exactly like $${poly([[a, "x"], [b, "x"]])}$.` },
        { math: rad([[a + b, m]]), note: "Add the coefficients." },
      ],
    };
  }
  if (kind === 1) {
    const m = r.pick(SMALL_SQUAREFREE);
    const k1 = r.int(1, 3);
    let k2 = r.int(2, 5);
    while (k2 === k1) k2 = r.int(2, 5);
    const s = r.sign();
    const [n1, n2] = [k1 * k1 * m, k2 * k2 * m];
    return {
      prompt: md`Simplify $\sqrt{${n1}} ${pm(s)} \sqrt{${n2}}$.`,
      answer: rad([[k1 + s * k2, m]], false),
      simplified: true,
      hint: "They don't look alike yet. Simplify each radical first.",
      solution: [
        {
          math: md`${rad([[k1, m]])} ${pm(s)} ${k2}\sqrt{${m}}`,
          note: k1 === 1 ? md`$\sqrt{${n2}} = \sqrt{${k2 * k2}}\sqrt{${m}} = ${k2}\sqrt{${m}}$.` : md`$\sqrt{${n1}} = ${k1}\sqrt{${m}}$ and $\sqrt{${n2}} = ${k2}\sqrt{${m}}$.`,
        },
        { math: rad([[k1 + s * k2, m]]), note: md`Now they are like radicals. Combine the coefficients: $${k1} ${pm(s)} ${k2} = ${k1 + s * k2}$.` },
      ],
    };
  }
  const m1 = r.pick(SMALL_SQUAREFREE);
  let m2 = r.pick(SMALL_SQUAREFREE);
  while (m2 === m1) m2 = r.pick(SMALL_SQUAREFREE);
  const [k1, k2] = [r.int(2, 4), r.int(2, 4)];
  const [s2, s3] = [r.sign(), r.sign()];
  let k3 = r.int(2, 4);
  while (k3 === k1) k3 = r.int(2, 4);
  const A = k1 + s3 * k3;
  const B = s2 * k2;
  const ans = rad([[A, m1], [B, m2]], false);
  return {
    prompt: md`Simplify $\sqrt{${k1 * k1 * m1}} ${pm(s2)} \sqrt{${k2 * k2 * m2}} ${pm(s3)} \sqrt{${k3 * k3 * m1}}$.`,
    answer: ans,
    simplified: true,
    hint: "Simplify all three radicals, then combine only the ones with the same number under the root.",
    solution: [
      { math: md`${k1}\sqrt{${m1}} ${pm(s2)} ${k2}\sqrt{${m2}} ${pm(s3)} ${k3}\sqrt{${m1}}`, note: "Simplify each radical: pull out the largest perfect square." },
      {
        math: rad([[A, m1], [B, m2]]),
        note: md`Combine the $\sqrt{${m1}}$ terms. $\sqrt{${m2}}$ is a different radical, so it stays separate, the way $x$ and $y$ do.`,
      },
    ],
  };
};

const multiplyRadicals: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = r.int(2, 5);
    const b = r.int(1, 4);
    const m = r.pick([2, 3, 5, 6, 10, 15]);
    const n = r.pick([2, 3, 5, 6, 10, 15]);
    const [K, P] = splitSquare(m * n);
    const steps: Step[] = [
      { math: md`(${a} \cdot ${b})\sqrt{${m} \cdot ${n}} = ${a * b}\sqrt{${m * n}}`, note: "Numbers multiply with numbers and roots with roots (commutative and associative properties, then the product rule)." },
    ];
    if (K > 1) steps.push({ math: md`= ${a * b} \cdot ${K}${P === 1 ? "" : md`\sqrt{${P}}`} = ${rad([[a * b * K, P]])}`, note: P === 1 ? md`${m * n} is a perfect square: $${K}^2$.` : md`Simplify: $${m * n} = ${K * K} \cdot ${P}$.` });
    else steps[0]!.note += ` ${m * n} has no square factor, so that's simplest form.`;
    return {
      prompt: md`Multiply $${a}\sqrt{${m}} \cdot ${b === 1 ? "" : b}\sqrt{${n}}$.`,
      answer: rad([[a * b * K, P]], false),
      simplified: true,
      expanded: true,
      hint: "Multiply the outside numbers together and the radicands together. Then simplify the root.",
      solution: steps,
    };
  }
  if (kind === 1) {
    const m = r.pick([2, 3, 5, 6, 10]);
    let n = r.pick([2, 3, 5, 6, 7, 10]);
    while (n === m) n = r.pick([2, 3, 5, 6, 7, 10]);
    const c = r.nonzero(-6, 6);
    const [K, P] = splitSquare(m * n);
    const ansTex = rad([[K, P], [c, m]]);
    return {
      prompt: md`Multiply $\sqrt{${m}}(\sqrt{${n}} ${signed(c)})$.`,
      answer: rad([[K, P], [c, m]], false),
      simplified: true,
      expanded: true,
      hint: md`Distribute $\sqrt{${m}}$ to both terms inside the parentheses.`,
      solution: [
        { math: md`\sqrt{${m}} \cdot \sqrt{${n}} ${c < 0 ? "-" : "+"} ${Math.abs(c)}\sqrt{${m}}`, note: md`Distribute $\sqrt{${m}}$.` },
        { math: md`\sqrt{${m * n}} ${c < 0 ? "-" : "+"} ${Math.abs(c)}\sqrt{${m}}`, note: "Product rule." },
        { math: ansTex, note: K > 1 ? md`Simplify: $\sqrt{${m * n}} = ${K}\sqrt{${P}}$. The two terms have different radicands, so they don't combine.` : "Nothing simplifies, and the two radicals are different, so they don't combine." },
      ],
    };
  }
  if (kind === 2) {
    const m = r.pick(SMALL_SQUAREFREE);
    const [a, b] = [r.int(1, 6), r.int(1, 6)];
    const [s, t] = [r.sign(), r.sign()];
    const mid = a * t + b * s;
    const constant = a * b + s * t * m;
    return {
      prompt: md`Multiply $(${a} ${pm(s)} \sqrt{${m}})(${b} ${pm(t)} \sqrt{${m}})$.`,
      answer: rad([[constant, 1], [mid, m]], false),
      simplified: true,
      expanded: true,
      hint: md`Use FOIL, the same as for two binomials. Remember $\sqrt{${m}} \cdot \sqrt{${m}} = ${m}$.`,
      solution: [
        { math: poly([[a * b, ""], [a * t, md`\sqrt{${m}}`], [b * s, md`\sqrt{${m}}`], [s * t * m, ""]]), note: md`First, outer, inner, last. The last product is $${s * t < 0 ? "-" : ""}\sqrt{${m}} \cdot \sqrt{${m}} = ${s * t * m}$.` },
        { math: rad([[constant, 1], [mid, m]]), note: "Combine the plain numbers, and combine the radical terms." },
      ],
    };
  }
  if (r.next() < 0.6) {
    const a = r.int(2, 8);
    const m = r.pick(SQUAREFREE);
    const s = r.sign();
    return {
      prompt: md`Multiply $(${a} ${pm(s)} \sqrt{${m}})(${a} ${pm(-s)} \sqrt{${m}})$.`,
      answer: String(a * a - m),
      simplified: true,
      expanded: true,
      hint: md`This has the shape $(x + y)(x - y)$. What does that always multiply to?`,
      solution: [
        { math: md`${a}^2 - (\sqrt{${m}})^2`, note: md`$(x + y)(x - y) = x^2 - y^2$, the difference of squares.` },
        { math: md`${a * a} - ${m} = ${a * a - m}`, note: "Squaring the root undoes it. The radicals are gone." },
      ],
    };
  }
  const m = r.pick([5, 6, 7, 10, 11, 13]);
  let n = r.pick(SMALL_SQUAREFREE);
  while (n === m) n = r.pick(SMALL_SQUAREFREE);
  return {
    prompt: md`Multiply $(\sqrt{${m}} + \sqrt{${n}})(\sqrt{${m}} - \sqrt{${n}})$.`,
    answer: String(m - n),
    simplified: true,
    expanded: true,
    hint: md`This has the shape $(x + y)(x - y)$. What does that always multiply to?`,
    solution: [
      { math: md`(\sqrt{${m}})^2 - (\sqrt{${n}})^2`, note: md`Difference of squares: the middle terms $-\sqrt{${m * n}}$ and $+\sqrt{${m * n}}$ cancel.` },
      { math: md`${m} - ${n} = ${m - n}`, note: "Each square undoes its root." },
    ],
  };
};

const CONJUGATE_PAIRS: [number, number][] = [
  [2, 3],
  [2, 5],
  [3, 5],
  [3, 7],
  [3, 10],
  [3, 11],
  [4, 13],
  [4, 14],
  [4, 15],
];

const rationalize: Generator = (r) => {
  const kind = r.int(0, 3);
  const NOTE = "Leave no square root in the denominator.";
  if (kind === 0) {
    const m = r.pick([2, 3, 5, 6, 7, 10]);
    const a = r.next() < 0.5 ? m * r.int(1, 3) : r.int(1, 12);
    const [ans, ansTex] = radOver(a, m, m);
    const g = gcd(a, m);
    return {
      prompt: md`Simplify $\frac{${a}}{\sqrt{${m}}}$. ${NOTE}`,
      answer: ans,
      simplified: true,
      hint: md`Multiply by $\frac{\sqrt{${m}}}{\sqrt{${m}}}$, which equals 1.`,
      solution: [
        { math: md`\frac{${a}}{\sqrt{${m}}} \cdot \frac{\sqrt{${m}}}{\sqrt{${m}}}`, note: md`Multiplying by a form of 1 doesn't change the value.` },
        { math: md`\frac{${rad([[a, m]])}}{${m}}`, note: md`$\sqrt{${m}} \cdot \sqrt{${m}} = ${m}$: the bottom is now a whole number.` },
        { math: ansTex, note: g > 1 ? md`Reduce: ${a} and ${m} share the factor ${g}.` : md`${a} and ${m} share no factor, so nothing cancels.` },
      ],
    };
  }
  if (kind === 1) {
    const b = r.pick(SMALL_SQUAREFREE);
    if (r.next() < 0.4) {
      const k = r.int(2, 5);
      return {
        prompt: md`Simplify $\frac{\sqrt{${b * k * k}}}{\sqrt{${b}}}$. ${NOTE}`,
        answer: String(k),
        simplified: true,
        hint: md`Use the quotient rule: $\frac{\sqrt{a}}{\sqrt{b}} = \sqrt{\frac{a}{b}}$.`,
        solution: [
          { math: md`\sqrt{\frac{${b * k * k}}{${b}}} = \sqrt{${k * k}}`, note: "Quotient rule, then divide." },
          { math: String(k), note: "" },
        ],
      };
    }
    let a = r.pick([2, 3, 5, 6, 7, 10]);
    while (a === b) a = r.pick([2, 3, 5, 6, 7, 10]);
    const [K, P] = splitSquare(a * b);
    const [ans, ansTex] = radOver(K, P, b);
    const steps: Step[] = [
      { math: md`\frac{\sqrt{${a}}}{\sqrt{${b}}} \cdot \frac{\sqrt{${b}}}{\sqrt{${b}}} = \frac{\sqrt{${a * b}}}{${b}}`, note: md`Multiply by $\frac{\sqrt{${b}}}{\sqrt{${b}}} = 1$. The bottom becomes ${b}.` },
    ];
    if (K > 1) steps.push({ math: md`\frac{${K}\sqrt{${P}}}{${b}}`, note: md`Simplify the top: $${a * b} = ${K * K} \cdot ${P}$.` });
    steps.push({ math: ansTex, note: gcd(K, b) > 1 ? "Reduce the fraction." : "Nothing cancels, so this is simplest form." });
    return {
      prompt: md`Simplify $\frac{\sqrt{${a}}}{\sqrt{${b}}}$. ${NOTE}`,
      answer: ans,
      simplified: true,
      hint: md`Multiply top and bottom by $\sqrt{${b}}$.`,
      solution: steps,
    };
  }
  const [p, m] = r.pick(CONJUGATE_PAIRS);
  const s = r.sign();
  const D = p * p - m;
  const a = Math.abs(D) * r.int(1, 3);
  const q = a / D;
  const conj = md`${p} ${pm(-s)} \sqrt{${m}}`;
  return {
    prompt: md`Simplify $\frac{${a}}{${p} ${pm(s)} \sqrt{${m}}}$. ${NOTE}`,
    answer: rad([[q * p, 1], [-q * s, m]], false),
    simplified: true,
    hint: md`Multiply top and bottom by the conjugate, $${conj}$. The bottom becomes a difference of squares.`,
    solution: [
      { math: md`\frac{${a}}{${p} ${pm(s)} \sqrt{${m}}} \cdot \frac{${conj}}{${conj}}`, note: "Multiply by the conjugate over itself, a form of 1." },
      { math: md`\frac{${a}(${conj})}{${p}^2 - (\sqrt{${m}})^2} = \frac{${a}(${conj})}{${D}}`, note: md`Difference of squares in the bottom: $${p * p} - ${m} = ${D}$.` },
      { math: rad([[q * p, 1], [-q * s, m]]), note: md`Divide: $\frac{${a}}{${D}} = ${q}$, then distribute.` },
    ],
  };
};

// ── Lesson 3 practice ───────────────────────────────────────────────────────

const basicRadical: Generator = (r): Problem => {
  const kind = r.pick([0, 0, 1, 2, 2, 3]);
  if (kind === 0 || kind === 1) {
    let b = r.int(2, 9);
    let c = 1;
    let a = r.nonzero(-9, 9);
    let x = b * b - a;
    if (kind === 1) {
      c = r.int(2, 5);
      for (;;) {
        b = r.int(2, 7);
        x = r.int(-3, 12);
        a = b * b - c * x;
        if (a !== 0 && Math.abs(a) <= 20) break;
      }
    }
    const inside = poly([[c, "x"], [a, ""]]);
    return {
      prompt: md`Solve $\sqrt{${inside}} = ${b}$. ${SET_NOTE}`,
      answer: String(x),
      form: "set",
      hint: "The radical is already alone. Square both sides to undo it.",
      solution: [
        { math: md`${inside} = ${b * b}`, note: md`Square both sides: $(\sqrt{${inside}})^2 = ${inside}$ and $${b}^2 = ${b * b}$.` },
        ...(c === 1 ? [] : [{ math: md`${c}x = ${b * b - a}`, note: md`${a > 0 ? "Subtract" : "Add"} ${Math.abs(a)}.` }]),
        { math: md`x = ${x}`, note: c === 1 ? md`${a > 0 ? "Subtract" : "Add"} ${Math.abs(a)}.` : md`Divide by ${c}.` },
        checkLine(x, c * x + a, b),
      ],
    };
  }
  const a = r.int(-9, 9);
  const inside = poly([[1, "x"], [a, ""]]);
  const c = r.pick([1, 1, 2, 3]);
  const front = c === 1 ? "" : String(c);
  if (kind === 2) {
    const b = r.int(1, 6);
    const k = r.nonzero(-9, 9);
    const d = c * b + k;
    const x = b * b - a;
    const steps: Step[] = [{ math: md`${front}\sqrt{${inside}} = ${d - k}`, note: md`Isolate the radical: ${k > 0 ? "subtract" : "add"} ${Math.abs(k)}.` }];
    if (c > 1) steps.push({ math: md`\sqrt{${inside}} = ${b}`, note: md`Divide by ${c}.` });
    steps.push(
      { math: md`${inside} = ${b * b}`, note: "Square both sides." },
      { math: md`x = ${x}`, note: a === 0 ? "" : md`${a > 0 ? "Subtract" : "Add"} ${Math.abs(a)}.` },
      { math: md`${front}\sqrt{${x + a}} ${signed(k)} = ${c * b} ${signed(k)} = ${d} \;\checkmark`, note: "Check in the original equation." },
    );
    return {
      prompt: md`Solve $${front}\sqrt{${inside}} ${signed(k)} = ${d}$. ${SET_NOTE}`,
      answer: String(x),
      form: "set",
      hint: "Get the square root alone on one side before squaring.",
      solution: steps,
    };
  }
  const b = r.int(1, 5);
  const k = r.int(2, 9);
  const d = k - c * b;
  const x0 = b * b - a;
  const steps: Step[] = [{ math: md`${front}\sqrt{${inside}} = ${-c * b}`, note: md`Isolate the radical: subtract ${k}.` }];
  if (c > 1) steps.push({ math: md`\sqrt{${inside}} = ${-b}`, note: md`Divide by ${c}.` });
  steps.push(
    { math: md`\sqrt{${inside}} \ge 0 > ${-b}`, note: "A square root is never negative, so no number can work. You can stop here." },
    { math: md`x = ${x0}: \quad ${front}\sqrt{${b * b}} ${signed(k)} = ${c * b + k} \ne ${d}`, note: md`If you square anyway, you get $x = ${x0}$, and it fails the check. **No solution.**` },
  );
  return {
    prompt: md`Solve $${front}\sqrt{${inside}} ${signed(k)} = ${d}$. ${SET_NOTE}`,
    accept: NO_SOLUTION,
    hint: "Isolate the square root first. Then ask: can a square root equal that?",
    solution: steps,
  };
};

const radicalQuadratic: Generator = (r): Problem => {
  const want = r.pick(["one", "one", "one", "both", "none"] as const);
  for (;;) {
    // √(ax + b) = ex + c, built so that (ex + c)² - (ax + b) = (x - s)(x - t).
    const e = want === "none" ? -1 : r.next() < 0.7 ? 1 : -1;
    const c = e === 1 ? r.int(-4, 3) : r.int(1, 8);
    const s = r.int(-5, 9);
    const t = r.int(-5, 9);
    if (s === t) continue;
    const a = s + t + 2 * e * c;
    const b = c * c - s * t;
    if (a < 1 || a > 12 || Math.abs(b) > 30) continue;
    const side = (v: number) => e * v + c;
    const good = [s, t].filter((v) => side(v) >= 0).sort((u, v) => u - v);
    if ((want === "one" && good.length !== 1) || (want === "both" && good.length !== 2) || (want === "none" && good.length !== 0)) continue;

    const inside = poly([[a, "x"], [b, ""]]);
    const right = e === 1 ? poly([[1, "x"], [c, ""]]) : poly([[c, ""], [-1, "x"]]);
    // Sometimes the radical starts out not isolated.
    const hidden = r.next() < 0.4 && c !== 0;
    const equation = !hidden ? md`\sqrt{${inside}} = ${right}` : e === 1 ? md`\sqrt{${inside}} ${signed(-c)} = x` : md`\sqrt{${inside}} + x = ${c}`;
    const steps: Step[] = [];
    if (hidden) steps.push({ math: md`\sqrt{${inside}} = ${right}`, note: e === 1 ? md`Isolate the radical: ${c > 0 ? "add" : "subtract"} ${Math.abs(c)}.` : md`Isolate the radical: subtract $x$.` });
    const [lo, hi] = [Math.min(s, t), Math.max(s, t)];
    steps.push(
      { math: md`${inside} = ${c === 0 ? "x^2" : md`(${right})^2`}`, note: "Square both sides." },
      ...(c === 0 ? [] : [{ math: md`${inside} = ${poly([[1, "x^2"], [2 * e * c, "x"], [c * c, ""]])}`, note: md`Expand the right side with $(p + q)^2 = p^2 + 2pq + q^2$.` }]),
      { math: md`0 = ${poly([[1, "x^2"], [-(s + t), "x"], [s * t, ""]])}`, note: md`Move everything to one side: it's a quadratic.` },
      { math: md`0 = ${factorPair(lo, hi)}`, note: md`Factor, so $x = ${lo}$ or $x = ${hi}$. These are only **candidates**.` },
      checkLine(lo, a * lo + b, side(lo)),
      checkLine(hi, a * hi + b, side(hi)),
    );
    if (good.length === 0) steps.push({ math: md`\text{no solution}`, note: "Both candidates came from the squared equation only." });
    return {
      prompt: md`Solve $${equation}$. ${SET_NOTE}`,
      ...(good.length ? { answer: good.join(", "), form: "set" as const } : { accept: NO_SOLUTION }),
      hint: "Isolate the radical, square both sides, and solve the quadratic. Then check every candidate in the equation from before you squared.",
      solution: steps,
    };
  }
};

const bothSides: Generator = (r): Problem => {
  const valid = r.next() < 0.7;
  if (r.next() < 0.5) {
    const a = r.int(1, 6);
    let c = r.int(1, 6);
    while (c === a) c = r.int(1, 6);
    const x = r.int(-2, 6);
    const R = valid ? r.int(1, 12) : r.int(-6, -1);
    const b = R - a * x;
    const d = R - c * x;
    const [L, Rt] = [poly([[a, "x"], [b, ""]]), poly([[c, "x"], [d, ""]])];
    return {
      prompt: md`Solve $\sqrt{${L}} = \sqrt{${Rt}}$. ${SET_NOTE}`,
      ...(valid ? { answer: String(x), form: "set" as const } : { accept: NO_SOLUTION }),
      hint: "Squaring removes both roots at once. Then check that the radicands aren't negative.",
      solution: [
        { math: md`${L} = ${Rt}`, note: "Square both sides." },
        { math: md`${poly([[a - c, "x"]])} = ${d - b}`, note: "Collect the x-terms on the left and the numbers on the right." },
        ...(a - c === 1 ? [] : [{ math: md`x = ${x}`, note: md`Divide by ${a - c}.` }]),
        valid
          ? { math: md`\sqrt{${R}} = \sqrt{${R}} \;\checkmark`, note: md`At $x = ${x}$ both radicands equal ${R}, which isn't negative. It works.` }
          : { math: md`\sqrt{${R}} = \sqrt{${R}}\;?`, note: md`At $x = ${x}$ both radicands are ${R}. The square root of a negative number isn't a real number, so $x = ${x}$ is extraneous. **No solution.**` },
      ],
    };
  }
  // √(x² + b) = x + c: squaring cancels the x² and leaves a linear equation.
  for (;;) {
    const c = r.nonzero(-5, 5);
    const x = r.int(-6, 6);
    const b = c * c + 2 * c * x;
    if (b === 0 || Math.abs(b) > 40) continue;
    if (x + c >= 0 !== valid) continue;
    const right = poly([[1, "x"], [c, ""]]);
    return {
      prompt: md`Solve $\sqrt{${poly([[1, "x^2"], [b, ""]])}} = ${right}$. ${SET_NOTE}`,
      ...(valid ? { answer: String(x), form: "set" as const } : { accept: NO_SOLUTION }),
      hint: "Square both sides and expand the right side. Watch what happens to the x² terms.",
      solution: [
        { math: md`${poly([[1, "x^2"], [b, ""]])} = ${poly([[1, "x^2"], [2 * c, "x"], [c * c, ""]])}`, note: md`Square both sides: $(${right})^2 = ${poly([[1, "x^2"], [2 * c, "x"], [c * c, ""]])}$.` },
        { math: md`${b} = ${poly([[2 * c, "x"], [c * c, ""]])}`, note: md`Subtract $x^2$ from both sides. The equation is linear now.` },
        { math: md`${2 * c}x = ${b - c * c} \Rightarrow x = ${x}`, note: md`Subtract ${c * c}, then divide by ${2 * c}.` },
        checkLine(x, x * x + b, x + c),
      ],
    };
  }
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit9: Unit = {
  title: "Radicals",
  lessons: [
    {
      id: "simplifying-square-roots",
      title: "Simplifying square roots",
      summary: "What a square root is, why √(ab) = √a·√b, and how to pull perfect squares out of a root.",
      blocks: [
        {
          kind: "text",
          body: md`Unit 8 used square roots to solve equations like $x^2 = 5$. This unit looks at them properly: what exactly $\sqrt{a}$ means, why the rules for roots hold, and how to calculate with them.

Squaring is easy to do: $5^2 = 25$. A square root goes the other way. Given 25, which number was squared to get it?

There are two answers, $5$ and $-5$, because $(-5)^2 = 25$ too. A square root has to pick one of them.`,
        },
        {
          kind: "key",
          title: "Square root",
          body: md`For $a \ge 0$, the **square root** $\sqrt{a}$ is the **nonnegative** number whose square is $a$. So

$$\sqrt{a} \ge 0 \quad\text{and}\quad (\sqrt{a})^2 = a.$$

The symbol $\sqrt{\phantom{a}}$ is a **radical**, and the number under it is the **radicand**. When we want the negative one, we write $-\sqrt{25} = -5$.`,
        },
        {
          kind: "why",
          title: "Why only the nonnegative one, and why no negatives inside?",
          body: md`If $\sqrt{25}$ could mean either 5 or $-5$, then $\sqrt{25} + 1$ would have two values. Picking the nonnegative one makes $\sqrt{a}$ a **function** (Unit 4): one input, one output.

Negative radicands are out because of the sign rules. A positive times a positive is positive, a negative times a negative is positive, and $0 \cdot 0 = 0$. No real number squares to $-9$, so $\sqrt{-9}$ isn't a real number.`,
        },
        {
          kind: "text",
          body: md`The **perfect squares** $1, 4, 9, 16, 25, 36, 49, 64, 81, 100, \ldots$ have whole-number roots. Most numbers don't. $\sqrt{20}$ is between $\sqrt{16} = 4$ and $\sqrt{25} = 5$, and no fraction or finite decimal equals it exactly.

That's why we keep roots as roots. $\sqrt{2}$ is an exact number. $1.414$ is a rounded one, and $1.414^2 = 1.999396$, not 2.`,
        },
        {
          kind: "plot",
          x: [-1, 17],
          y: [-1, 5],
          curves: [{ expr: "sqrt(x)", label: md`y = \sqrt{x}`, domain: [0, 17] }],
          points: [
            { x: 1, y: 1, label: "(1, 1)" },
            { x: 4, y: 2, label: "(4, 2)" },
            { x: 9, y: 3, label: "(9, 3)" },
            { x: 16, y: 4, label: "(16, 4)" },
          ],
          caption: md`The points are the perfect squares. Between them the curve runs smoothly, so $\sqrt{5}$ sits somewhere between 2 and 3. The graph starts at 0 and never goes below the axis.`,
        },
        {
          kind: "why",
          title: "Why √(ab) = √a · √b",
          body: md`Take $a, b \ge 0$. We want to know whether $\sqrt{a}\cdot\sqrt{b}$ is the square root of $ab$. By the definition, that means checking two things: is it nonnegative, and does it square to $ab$?

- It's nonnegative: both factors are.
- Square it, using the power of a product from Unit 6, $(xy)^2 = x^2y^2$:
$$(\sqrt{a}\cdot\sqrt{b})^2 = (\sqrt{a})^2 \cdot (\sqrt{b})^2 = a \cdot b.$$

Only one nonnegative number squares to $ab$, and that number is $\sqrt{ab}$. So $\sqrt{a}\cdot\sqrt{b} = \sqrt{ab}$. The same argument with division gives the quotient rule.`,
        },
        {
          kind: "key",
          title: "Product and quotient rules",
          body: md`For $a \ge 0$ and $b \ge 0$:

$$\sqrt{ab} = \sqrt{a}\cdot\sqrt{b} \qquad\qquad \sqrt{\frac{a}{b}} = \frac{\sqrt{a}}{\sqrt{b}} \;\;(b \ne 0)$$

Check one: $\sqrt{4 \cdot 9} = \sqrt{36} = 6$, and $\sqrt{4}\cdot\sqrt{9} = 2 \cdot 3 = 6$.`,
        },
        {
          kind: "why",
          title: "Why there's no rule for √(a + b)",
          body: md`Try numbers: $\sqrt{9 + 16} = \sqrt{25} = 5$, but $\sqrt{9} + \sqrt{16} = 3 + 4 = 7$. Not equal.

The algebra says why. Square $\sqrt{a} + \sqrt{b}$ with $(x + y)^2 = x^2 + 2xy + y^2$:
$$(\sqrt{a} + \sqrt{b})^2 = a + 2\sqrt{ab} + b.$$
That's bigger than $a + b$ by $2\sqrt{ab}$, so $\sqrt{a} + \sqrt{b}$ can't be the root of $a + b$ (unless $a$ or $b$ is 0). Roots split over multiplication, never over addition.`,
        },
        {
          kind: "key",
          title: "Simplest radical form",
          body: md`A square root is in **simplest form** when:

- the radicand has no perfect-square factor other than 1,
- there's no fraction under the root,
- there's no root in a denominator (next lesson).

To simplify, write the radicand as (largest perfect square) $\times$ (the rest), then use the product rule.`,
        },
        {
          kind: "example",
          title: "Pulling out a perfect square",
          problem: md`Simplify $\sqrt{72}$.`,
          steps: [
            { math: md`\sqrt{72} = \sqrt{36 \cdot 2}`, note: "36 is the largest perfect square that divides 72." },
            { math: md`= \sqrt{36}\cdot\sqrt{2}`, note: "Product rule." },
            { math: md`= 6\sqrt{2}`, note: "2 has no square factor, so this is simplest form." },
            { math: md`\sqrt{72} = \sqrt{4 \cdot 18} = 2\sqrt{18} = 2 \cdot 3\sqrt{2} = 6\sqrt{2}`, note: "Starting with a smaller square also works. It just takes more rounds." },
          ],
        },
        {
          kind: "example",
          title: "A quadratic formula answer",
          problem: md`Simplify $\frac{6 + \sqrt{20}}{2}$.`,
          steps: [
            { math: md`\sqrt{20} = \sqrt{4}\cdot\sqrt{5} = 2\sqrt{5}`, note: "Simplify the root first." },
            { math: md`\frac{6 + 2\sqrt{5}}{2} = \frac{6}{2} + \frac{2\sqrt{5}}{2}`, note: "The fraction bar divides the whole top, so each term gets divided." },
            { math: md`3 + \sqrt{5}`, note: "This shape comes up all the time with the quadratic formula (Unit 8)." },
          ],
        },
        {
          kind: "text",
          body: md`**With variables.** Since a square root is never negative, $\sqrt{x^2} = |x|$, not $x$: if $x = -3$, then $\sqrt{(-3)^2} = \sqrt{9} = 3$. When we know $x \ge 0$, the bars can go, and even powers come out of the root at half the exponent: $\sqrt{x^6} = x^3$ because $(x^3)^2 = x^6$. An odd power leaves one factor behind: $\sqrt{x^5} = \sqrt{x^4}\cdot\sqrt{x} = x^2\sqrt{x}$.`,
        },
        {
          kind: "check",
          prompt: md`Simplify $\sqrt{50}$.`,
          answer: "5sqrt(2)",
          simplified: true,
          explain: md`$50 = 25 \cdot 2$, so $\sqrt{50} = \sqrt{25}\cdot\sqrt{2} = 5\sqrt{2}$. You can type it as **5sqrt(2)** or ` + "**5√2**.",
        },
        {
          kind: "check",
          prompt: md`Simplify $3\sqrt{48}$.`,
          answer: "12sqrt(3)",
          simplified: true,
          explain: md`$48 = 16 \cdot 3$, so $\sqrt{48} = 4\sqrt{3}$, and $3 \cdot 4\sqrt{3} = 12\sqrt{3}$. Using $48 = 4 \cdot 12$ would leave $\sqrt{12}$, which still simplifies.`,
        },
      ],
      practice: [rootValues, simplifyRoot, rootFraction],
    },
    {
      id: "operations-with-radicals",
      title: "Operations with radicals",
      summary: "Adding, multiplying and dividing roots with rules you already know, and rationalizing denominators.",
      blocks: [
        {
          kind: "text",
          body: md`Once roots are in simplest form, arithmetic with them needs no new rules. Treat $\sqrt{2}$ like a variable that happens to have a known value. Then adding is combining like terms, multiplying is the distributive property and FOIL, and dividing uses the identity property.`,
        },
        {
          kind: "why",
          title: "Why 3√2 + 5√2 = 8√2, but √2 + √3 stays as it is",
          body: md`Three $\sqrt{2}$'s plus five $\sqrt{2}$'s is eight $\sqrt{2}$'s. Formally it's the distributive property backwards (Unit 1):
$$3\sqrt{2} + 5\sqrt{2} = (3 + 5)\sqrt{2} = 8\sqrt{2}.$$

$\sqrt{2} + \sqrt{3}$ has no common factor to pull out, the same way $2x + 3y$ doesn't combine. And it isn't $\sqrt{5}$: $\sqrt{2} + \sqrt{3} \approx 1.41 + 1.73 = 3.14$, while $\sqrt{5} \approx 2.24$.`,
        },
        {
          kind: "key",
          title: "Like radicals",
          body: md`**Like radicals** have the same radicand, like $4\sqrt{5}$ and $-\sqrt{5}$. Add or subtract them by combining coefficients.

Radicals that look different may be alike after simplifying, so **simplify every root first**.`,
        },
        {
          kind: "example",
          title: "Simplify, then combine",
          problem: md`Simplify $\sqrt{12} + \sqrt{75} - \sqrt{3}$.`,
          steps: [
            { math: md`2\sqrt{3} + 5\sqrt{3} - \sqrt{3}`, note: md`$\sqrt{12} = \sqrt{4}\sqrt{3}$ and $\sqrt{75} = \sqrt{25}\sqrt{3}$.` },
            { math: md`(2 + 5 - 1)\sqrt{3} = 6\sqrt{3}`, note: "All three are like radicals now. Combine the coefficients." },
          ],
        },
        {
          kind: "text",
          body: md`**Multiplying.** The product rule works in both directions: $\sqrt{a}\cdot\sqrt{b} = \sqrt{ab}$. When there are numbers in front, the commutative and associative properties let you regroup: numbers with numbers, roots with roots.

$$2\sqrt{3} \cdot 5\sqrt{7} = (2 \cdot 5)(\sqrt{3}\cdot\sqrt{7}) = 10\sqrt{21}$$

One product shows up constantly: $\sqrt{a}\cdot\sqrt{a} = a$. That is just the definition, $(\sqrt{a})^2 = a$.`,
        },
        {
          kind: "example",
          title: "Multiply, then simplify",
          problem: md`Multiply $2\sqrt{6} \cdot 3\sqrt{10}$.`,
          steps: [
            { math: md`(2 \cdot 3)\sqrt{6 \cdot 10} = 6\sqrt{60}`, note: "Regroup and use the product rule." },
            { math: md`6\sqrt{4 \cdot 15} = 6 \cdot 2\sqrt{15}`, note: "60 has the square factor 4." },
            { math: md`12\sqrt{15}`, note: "15 = 3 · 5 has no square factor, so this is simplest form." },
          ],
        },
        {
          kind: "example",
          title: "FOIL with radicals",
          problem: md`Multiply $(3 + \sqrt{2})(1 - \sqrt{2})$.`,
          steps: [
            { math: md`3 - 3\sqrt{2} + \sqrt{2} - \sqrt{2}\cdot\sqrt{2}`, note: "First, outer, inner, last, exactly as with binomials." },
            { math: md`3 - 3\sqrt{2} + \sqrt{2} - 2`, note: md`$\sqrt{2}\cdot\sqrt{2} = 2$.` },
            { math: md`1 - 2\sqrt{2}`, note: "Combine the numbers, and combine the like radicals." },
          ],
        },
        {
          kind: "why",
          title: "Why conjugates make the root disappear",
          body: md`$a + \sqrt{b}$ and $a - \sqrt{b}$ are called **conjugates**. Their product has the shape $(x + y)(x - y)$, which is a difference of squares (Unit 7):
$$(a + \sqrt{b})(a - \sqrt{b}) = a^2 - (\sqrt{b})^2 = a^2 - b.$$
The middle terms $-a\sqrt{b}$ and $+a\sqrt{b}$ cancel, and squaring the root undoes it. The result has no radical at all. For example, $(4 + \sqrt{3})(4 - \sqrt{3}) = 16 - 3 = 13$.`,
        },
        {
          kind: "check",
          prompt: md`Multiply $(5 + \sqrt{3})(5 - \sqrt{3})$.`,
          answer: "22",
          simplified: true,
          expanded: true,
          explain: md`Conjugates: $5^2 - (\sqrt{3})^2 = 25 - 3 = 22$.`,
        },
        {
          kind: "why",
          title: "Why we may multiply by √3/√3",
          body: md`A fraction like $\frac{6}{\sqrt{3}}$ has a root in the denominator. To remove it, multiply by $\frac{\sqrt{3}}{\sqrt{3}}$. That fraction equals 1, and multiplying by 1 never changes a value (the identity property). It only changes how the number is written:
$$\frac{6}{\sqrt{3}} \cdot \frac{\sqrt{3}}{\sqrt{3}} = \frac{6\sqrt{3}}{3} = 2\sqrt{3}.$$

Why bother? Having one agreed form makes answers easy to compare: $\frac{6}{\sqrt{3}}$ and $2\sqrt{3}$ don't look equal, but they are. It also makes estimating easy. Dividing by $1.732$ by hand is painful; doubling it is not.`,
        },
        {
          kind: "key",
          title: "Rationalizing the denominator",
          body: md`- A single root in the bottom: multiply top and bottom by that root. $\frac{a}{\sqrt{b}} = \frac{a\sqrt{b}}{b}$.
- A sum or difference in the bottom: multiply top and bottom by its **conjugate**, so the bottom becomes a difference of squares.

Then simplify and reduce.`,
        },
        {
          kind: "example",
          title: "A root in the denominator",
          problem: md`Simplify $\frac{5}{\sqrt{6}}$.`,
          steps: [
            { math: md`\frac{5}{\sqrt{6}} \cdot \frac{\sqrt{6}}{\sqrt{6}}`, note: "Multiply by a form of 1." },
            { math: md`\frac{5\sqrt{6}}{6}`, note: md`$\sqrt{6}\cdot\sqrt{6} = 6$. 5 and 6 share no factor, so it's done.` },
          ],
        },
        {
          kind: "example",
          title: "Using the conjugate",
          problem: md`Simplify $\frac{4}{3 - \sqrt{5}}$.`,
          steps: [
            { math: md`\frac{4}{3 - \sqrt{5}} \cdot \frac{3 + \sqrt{5}}{3 + \sqrt{5}}`, note: "Multiplying by just √5 wouldn't work: the bottom would become 3√5 - 5. The conjugate is what clears it." },
            { math: md`\frac{4(3 + \sqrt{5})}{9 - 5} = \frac{4(3 + \sqrt{5})}{4}`, note: "Difference of squares in the bottom." },
            { math: md`3 + \sqrt{5}`, note: "The 4s cancel." },
          ],
        },
        {
          kind: "check",
          prompt: md`Simplify $\frac{10}{\sqrt{5}}$. Leave no square root in the denominator.`,
          answer: "2sqrt(5)",
          simplified: true,
          explain: md`$\frac{10}{\sqrt{5}} \cdot \frac{\sqrt{5}}{\sqrt{5}} = \frac{10\sqrt{5}}{5} = 2\sqrt{5}$.`,
        },
      ],
      practice: [addRadicals, multiplyRadicals, rationalize],
    },
    {
      id: "radical-equations",
      title: "Radical equations",
      summary: "Squaring both sides to solve, and why every answer must be checked.",
      blocks: [
        {
          kind: "text",
          body: md`A **radical equation** has the variable under a root, like $\sqrt{x + 3} = 5$. The plan from Unit 2 still holds: undo what was done to $x$. A square root is undone by squaring, since $(\sqrt{a})^2 = a$.`,
        },
        {
          kind: "example",
          title: "Square both sides",
          problem: md`Solve $\sqrt{x + 3} = 5$.`,
          steps: [
            { math: md`x + 3 = 25`, note: md`Square both sides: $(\sqrt{x + 3})^2 = x + 3$ and $5^2 = 25$.` },
            { math: md`x = 22`, note: "Subtract 3." },
            { math: md`\sqrt{22 + 3} = \sqrt{25} = 5 \;\checkmark`, note: "Check in the original equation." },
          ],
        },
        {
          kind: "why",
          title: "Why squaring can add wrong answers",
          body: md`Squaring both sides is allowed: if $A = B$, then $A^2 = B^2$, because doing the same thing to both sides keeps a true equation true.

But it doesn't run backwards. $3^2 = 9$ and $(-3)^2 = 9$, so $A^2 = B^2$ only tells you that $A = B$ **or** $A = -B$. Squaring quietly merges two equations into one. When you solve the squared version, you can pick up solutions of $A = -B$, the equation you never asked about.

Every other move in this course (adding, multiplying by a nonzero number) can be undone, so it never changes the solutions. Squaring can't be undone, so its results are only **candidates**.`,
        },
        {
          kind: "key",
          title: "Solving a radical equation",
          body: md`- **Isolate** the radical on one side.
- **Square** both sides.
- **Solve** the equation that results.
- **Check** every candidate in the original equation.

A candidate that fails the check is called **extraneous**. Throw it out. If every candidate fails, the equation has no solution.`,
        },
        {
          kind: "example",
          title: "One real answer, one extraneous",
          problem: md`Solve $\sqrt{x} + 2 = x$.`,
          steps: [
            { math: md`\sqrt{x} = x - 2`, note: "Isolate the radical: subtract 2." },
            { math: md`x = x^2 - 4x + 4`, note: md`Square both sides. $(x - 2)^2 = x^2 - 4x + 4$.` },
            { math: md`0 = x^2 - 5x + 4 = (x - 1)(x - 4)`, note: "Collect on one side and factor. The candidates are 1 and 4." },
            { math: md`x = 4: \quad \sqrt{4} + 2 = 4 \;\checkmark`, note: "Works." },
            { math: md`x = 1: \quad \sqrt{1} + 2 = 3 \ne 1`, note: md`Fails. It solved $-\sqrt{x} = x - 2$ instead. The only solution is $x = 4$.` },
          ],
        },
        {
          kind: "plot",
          x: [-1, 7],
          y: [-3, 4],
          curves: [
            { expr: "sqrt(x)", label: md`y = \sqrt{x}`, color: 1, domain: [0, 7] },
            { expr: "-sqrt(x)", label: md`y = -\sqrt{x}`, color: 1, dashed: true, domain: [0, 7] },
            { expr: "x - 2", label: md`y = x - 2`, color: 2 },
          ],
          points: [
            { x: 4, y: 2, label: md`(4, 2)\ \text{solution}`, color: 3 },
            { x: 1, y: -1, label: md`(1, -1)\ \text{extraneous}`, color: 4, open: true },
          ],
          caption: md`Solutions of $\sqrt{x} = x - 2$ are where the line meets the solid curve: only $x = 4$. Squaring also counts where it meets the dashed curve $y = -\sqrt{x}$, because $(-\sqrt{x})^2 = x$ too. That's where $x = 1$ comes from.`,
        },
        {
          kind: "why",
          title: "Why isolate first?",
          body: md`If you square $\sqrt{x} + 2 = x$ without isolating, the left side becomes $(\sqrt{x} + 2)^2 = x + 4\sqrt{x} + 4$. The middle term from $(a + b)^2$ keeps a root around, and you're no better off. With the radical alone, squaring removes it completely.`,
        },
        {
          kind: "text",
          body: md`**Spot the impossible ones early.** In $\sqrt{x + 1} + 7 = 4$, isolating gives $\sqrt{x + 1} = -3$. A square root is never negative, so there's no solution. Squaring anyway would give $x = 8$, and the check $\sqrt{9} + 7 = 10 \ne 4$ catches it.

**Roots on both sides.** Squaring $\sqrt{3x - 2} = \sqrt{x + 6}$ removes both roots: $3x - 2 = x + 6$, so $x = 4$. Check: both sides are $\sqrt{10}$. Here the danger is a candidate that makes the radicands negative, where the roots don't exist.`,
        },
        {
          kind: "check",
          prompt: md`Solve $\sqrt{2x + 1} = 7$. ${SET_NOTE}`,
          answer: "24",
          form: "set",
          explain: md`Square: $2x + 1 = 49$, so $2x = 48$ and $x = 24$. Check: $\sqrt{49} = 7 \;\checkmark$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $\sqrt{x + 6} = x$. ${SET_NOTE}`,
          answer: "3",
          form: "set",
          explain: md`Square: $x + 6 = x^2$, so $x^2 - x - 6 = (x - 3)(x + 2) = 0$. Check $x = 3$: $\sqrt{9} = 3 \;\checkmark$. Check $x = -2$: $\sqrt{4} = 2 \ne -2$, extraneous. The only solution is $3$.`,
        },
      ],
      practice: [basicRadical, radicalQuadratic, bothSides],
    },
  ],
};
