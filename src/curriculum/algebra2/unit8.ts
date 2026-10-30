import { frac, fracTex, gcd, poly, type Rng } from "../../math/random";
import { md, type DiagramSpec, type Generator, type Problem, type Step, type Unit } from "../types";

// ── Shared wording ──────────────────────────────────────────────────────────

const COUNT = "Give a whole number without commas (a product, a power or factorials like 8!/5! is fine).";
const NUMBER = "Give a whole number without commas.";
const INTEGER = "Give an integer without commas (it may be negative).";
const PROB = "Give the probability as a fraction in lowest terms.";

// ── Counting helpers ────────────────────────────────────────────────────────

function fact(n: number): number {
  let f = 1;
  for (let k = 2; k <= n; k++) f *= k;
  return f;
}

/** Ordered arrangements of r objects chosen from n. */
const nPr = (n: number, r: number) => fact(n) / fact(n - r);

/** Unordered selections of r objects from n. */
function nCr(n: number, r: number): number {
  let c = 1;
  for (let k = 1; k <= r; k++) c = (c * (n - r + k)) / k;
  return Math.round(c);
}

/** n(n - 1)...(n - r + 1), joined by `sep`. */
const falling = (n: number, r: number, sep: string) => Array.from({ length: r }, (_, i) => n - i).join(sep);
const fallTex = (n: number, r: number) => falling(n, r, " \\cdot ");
const fallText = (n: number, r: number) => falling(n, r, " * ");

/** A whole number with thin-space thousands separators, for LaTeX. */
const big = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "{,}");

/** x^k as LaTeX/answer text: "", "x", "x^3". Exponents of 10 or more get braces. */
const pow = (v: string, k: number) => (k === 0 ? "" : k === 1 ? v : k < 10 ? `${v}^${k}` : `${v}^{${k}}`);

/** x^a y^b as a monomial string. */
const mono = (a: number, b: number) => `${pow("x", a)}${pow("y", b)}`;

/** A number in parentheses when negative. */
const par = (n: number) => (n < 0 ? `(${n})` : String(n));

// ── Lesson 1: Counting principles ───────────────────────────────────────────

const multiplicationPrinciple: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const [s, p, k] = [r.int(3, 8), r.int(2, 6), r.int(2, 4)];
    return {
      prompt: md`You own ${s} shirts, ${p} pairs of pants and ${k} pairs of shoes. An outfit is one of each. How many different outfits are there? ${COUNT}`,
      answer: String(s * p * k),
      verify: [`x = ${s} * ${p} * ${k}`],
      hint: "Three choices in a row. Each choice has the same number of options whatever you picked before, so multiply.",
      solution: [
        { math: md`${s} \cdot ${p} \cdot ${k}`, note: "One factor for each stage: shirt, then pants, then shoes." },
        { math: String(s * p * k), note: md`Each of the ${s} shirts starts ${p} branches, and each of those splits into ${k}.` },
      ],
    };
  }
  if (kind === 1) {
    const [L, D] = [r.int(2, 3), r.int(2, 4)];
    const total = 26 ** L * 10 ** D;
    return {
      prompt: md`A license plate has ${L} letters (A to Z) followed by ${D} digits (0 to 9). Letters and digits may repeat. How many different plates are possible? ${COUNT}`,
      answer: String(total),
      verify: [`x = 26^${L} * 10^${D}`],
      hint: "Fill the plate one position at a time. Each letter position has 26 options and each digit position has 10.",
      solution: [
        { math: md`\underbrace{${Array(L).fill("26").join(" \\cdot ")}}_{\text{letters}} \cdot \underbrace{${Array(D).fill("10").join(" \\cdot ")}}_{\text{digits}}`, note: "Repeats are allowed, so every position keeps all its options." },
        { math: md`26^${L} \cdot 10^${D} = ${big(total)}`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const k = r.int(3, 5);
    return {
      prompt: md`A lock code is ${k} digits long (0 to 9), and no digit may be used twice. Order matters: 1-2-3 and 3-2-1 are different codes. How many codes are possible? ${COUNT}`,
      answer: String(nPr(10, k)),
      verify: [`x = ${fallText(10, k)}`],
      hint: "The first digit has 10 options. Each digit you use is gone for the later positions.",
      solution: [
        { math: fallTex(10, k), note: "The options shrink by one at each position. The number of options never depends on which digits were used, only on how many." },
        { math: big(nPr(10, k)), note: "" },
      ],
    };
  }
  if (kind === 3) {
    const cases: [string, [number, number, number], string][] = [
      ["have only odd digits", [5, 5, 5], "Each of the three positions can be 1, 3, 5, 7 or 9."],
      ["are odd", [9, 10, 5], "The first digit can't be 0, so it has 9 options. The middle digit is free. The last digit must be 1, 3, 5, 7 or 9."],
      ["have no digit equal to 0", [9, 9, 9], "Each position can be 1 through 9."],
      ["have three different digits", [9, 9, 8], "The first digit is 1 through 9. The second can be any of the 10 digits except the first. The third avoids both."],
      ["are multiples of 5", [9, 10, 2], "The first digit can't be 0. The last digit must be 0 or 5."],
      ["start with an even digit", [4, 10, 10], "The first digit is 2, 4, 6 or 8 (0 would not make a three-digit number)."],
    ];
    const [cond, f, why] = r.pick(cases);
    const total = f[0] * f[1] * f[2];
    return {
      prompt: md`How many three-digit numbers (100 to 999) ${cond}? ${COUNT}`,
      answer: String(total),
      verify: [`x = ${f.join(" * ")}`],
      hint: "Count the options for the hundreds digit, the tens digit and the ones digit, then multiply. Remember the first digit can't be 0.",
      solution: [
        { math: md`${f[0]} \cdot ${f[1]} \cdot ${f[2]}`, note: why },
        { math: String(total), note: "Multiplication principle." },
      ],
    };
  }
  const c = r.pick([2, 3, 4, 5]);
  const n = c === 2 ? r.int(4, 10) : r.int(3, 6);
  const what = c === 2 ? "true-or-false question" : `multiple-choice question with ${c} options`;
  return {
    prompt: md`A quiz has ${n} questions, and each is a ${what}. Every question gets exactly one answer. How many different answer sheets are possible? ${COUNT}`,
    answer: String(c ** n),
    verify: [`x = ${c}^${n}`],
    hint: md`There are $${n}$ stages, and each has $${c}$ options.`,
    solution: [
      { math: md`\underbrace{${Array(n).fill(String(c)).join(" \\cdot ")}}_{${n}}`, note: "Each question is a stage with the same options." },
      { math: md`${c}^{${n}} = ${big(c ** n)}`, note: "" },
    ],
  };
};

const factorials: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const n = r.int(4, 8);
    return {
      prompt: md`Compute $${n}!$. ${NUMBER}`,
      answer: String(fact(n)),
      simplified: true,
      hint: md`$${n}! = ${fallTex(n, n)}$.`,
      solution: [
        { math: md`${n}! = ${fallTex(n, n)}`, note: "Multiply every whole number from n down to 1." },
        { math: big(fact(n)), note: "" },
      ],
    };
  }
  if (kind === 1) {
    const n = r.int(6, 12);
    const m = n - r.int(2, 3);
    const k = n - m;
    return {
      prompt: md`Compute $\frac{${n}!}{${m}!}$. ${NUMBER}`,
      answer: String(nPr(n, k)),
      simplified: true,
      hint: md`Don't multiply out either factorial. Write $${n}! = ${fallTex(n, k)} \cdot ${m}!$ and cancel.`,
      solution: [
        { math: md`\frac{${fallTex(n, k)} \cdot ${m}!}{${m}!}`, note: md`$${n}!$ contains $${m}!$ as its tail: $n! = n \cdot (n - 1)!$, used ${k} times.` },
        { math: md`${fallTex(n, k)} = ${big(nPr(n, k))}`, note: md`The $${m}!$ cancels.` },
      ],
    };
  }
  if (kind === 2) {
    const n = r.int(5, 10);
    const a = r.int(2, n - 2);
    const b = n - a;
    const [hi, lo] = a >= b ? [a, b] : [b, a];
    const value = nCr(n, a);
    return {
      prompt: md`Compute $\frac{${n}!}{${a}!\,${b}!}$. ${NUMBER}`,
      answer: String(value),
      simplified: true,
      hint: md`Cancel the larger factorial, $${hi}!$, first. What's left is $\frac{${fallTex(n, lo)}}{${lo}!}$.`,
      solution: [
        { math: md`\frac{${fallTex(n, lo)} \cdot ${hi}!}{${lo}! \cdot ${hi}!} = \frac{${fallTex(n, lo)}}{${fallTex(lo, lo)}}`, note: md`Write $${n}!$ down to $${hi}!$ and cancel it.` },
        { math: md`\frac{${big(nPr(n, lo))}}{${fact(lo)}} = ${value}`, note: "It always comes out whole. Lesson 2 shows why: this number counts something." },
      ],
    };
  }
  const n = r.int(4, 8);
  if (kind === 3) {
    const setting = r.pick([
      `${n} different books be arranged in a row on a shelf`,
      `${n} runners finish a race, if there are no ties`,
      `${n} people stand in a line for a photo`,
    ]);
    return {
      prompt: md`In how many orders can ${setting}? ${COUNT}`,
      answer: String(fact(n)),
      verify: [`x = ${n}!`],
      hint: "Fill the positions one at a time: how many options for the first, then the second, and so on?",
      solution: [
        { math: md`${fallTex(n, n)}`, note: "The first position has n options, the next has one fewer, down to 1." },
        { math: md`${n}! = ${big(fact(n))}`, note: "" },
      ],
    };
  }
  return {
    prompt: md`${n} friends line up for a photo, and Sam (one of them) insists on standing at the left end. How many different lineups are possible? ${COUNT}`,
    answer: String(fact(n - 1)),
    verify: [`x = 1 * ${n - 1}!`],
    hint: "The left end has only one option. Then arrange everyone else.",
    solution: [
      { math: md`1 \cdot ${fallTex(n - 1, n - 1)}`, note: md`Sam's spot is forced (1 option). The other ${n - 1} friends fill the remaining spots in any order.` },
      { math: md`${n - 1}! = ${big(fact(n - 1))}`, note: "" },
    ],
  };
};

const casesAndComplements: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const k = r.int(3, 4);
    const all = 10 ** k;
    const none = nPr(10, k);
    return {
      prompt: md`A PIN is ${k} digits long (0 to 9, repeats allowed). How many PINs have **at least one** repeated digit? ${COUNT}`,
      answer: String(all - none),
      verify: [`x + ${fallText(10, k)} = 10^${k}`],
      hint: `"At least one repeat" has many cases. Its opposite, "all digits different", has one. Count all PINs and subtract.`,
      solution: [
        { math: md`10^${k} = ${big(all)}`, note: "All PINs: 10 options for each position." },
        { math: md`${fallTex(10, k)} = ${big(none)}`, note: "PINs with no repeat: the options shrink by one each time." },
        { math: md`${big(all)} - ${big(none)} = ${big(all - none)}`, note: "Every PIN either has a repeat or doesn't, never both. So the two groups add up to the total." },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(3, 6);
    const m = r.int(3, 4);
    const letters = "ABCDEF".slice(0, a);
    const lengths = Array.from({ length: m }, (_, i) => i + 1);
    const total = lengths.reduce((s, j) => s + a ** j, 0);
    return {
      prompt: md`A code uses the letters ${letters.split("").join(", ")} (repeats allowed) and is ${lengths.slice(0, -1).join(", ")} or ${m} letters long. How many codes are possible? ${COUNT}`,
      answer: String(total),
      verify: [`x = ${lengths.map((j) => `${a}^${j}`).join(" + ")}`],
      hint: "Split by length. Codes of different lengths can never be the same code, so count each length and add.",
      solution: [
        { math: lengths.map((j) => pow(String(a), j)).join(" + "), note: md`Length $j$: $${a}$ options for each of $j$ letters gives $${a}^j$.` },
        { math: lengths.map((j) => String(a ** j)).join(" + ") + ` = ${big(total)}`, note: "Addition principle: the cases don't overlap." },
      ],
    };
  }
  if (kind === 2) {
    const n = r.int(3, 8);
    return {
      prompt: md`A coin is flipped ${n} times and the sequence of heads and tails is written down. How many sequences contain **at least one** head? ${COUNT}`,
      answer: String(2 ** n - 1),
      verify: [`x + 1 = 2^${n}`],
      hint: "Count all sequences, then remove the ones with no heads at all. How many of those are there?",
      solution: [
        { math: md`2^{${n}} = ${2 ** n}`, note: "All sequences: 2 options per flip." },
        { math: md`2^{${n}} - 1 = ${2 ** n - 1}`, note: "Exactly one sequence has no heads: all tails." },
      ],
    };
  }
  if (kind === 3) {
    const L = r.int(2, 3);
    const [all, none] = [26 ** L, 21 ** L];
    return {
      prompt: md`How many ${L}-letter strings (A to Z, repeats allowed, any string counts) contain **at least one** vowel? Take the vowels to be A, E, I, O and U. ${COUNT}`,
      answer: String(all - none),
      verify: [`x + 21^${L} = 26^${L}`],
      hint: "Count the strings with no vowels at all and subtract them from the total.",
      solution: [
        { math: md`26^${L} = ${big(all)}`, note: "All strings." },
        { math: md`21^${L} = ${big(none)}`, note: "No vowels: each letter is one of the 21 consonants." },
        { math: md`${big(all)} - ${big(none)} = ${big(all - none)}`, note: "Complement: total minus the strings with none." },
      ],
    };
  }
  const [a, b, d] = [r.int(2, 5), r.int(2, 5), r.int(2, 6)];
  return {
    prompt: md`A lunch special is **either** a soup (${a} kinds) **or** a salad (${b} kinds), together with one drink (${d} kinds). How many different specials are there? ${COUNT}`,
    answer: String((a + b) * d),
    verify: [`x = (${a} + ${b}) * ${d}`],
    hint: "First count the choices for the first course: soup or salad are separate cases, so add. Then multiply by the drinks.",
    solution: [
      { math: md`${a} + ${b} = ${a + b}`, note: "Addition principle: a soup and a salad are never the same choice." },
      { math: md`${a + b} \cdot ${d} = ${(a + b) * d}`, note: "Multiplication principle: then choose a drink." },
    ],
  };
};

const treeDiagram: DiagramSpec = {
  view: [-1.8, 10.6, -4.4, 4.9],
  points: [
    { name: "O", x: 0, y: 0, label: "\\text{start}", dir: "w" },
    { name: "R", x: 3.5, y: 3, label: "\\text{red}", dir: "n" },
    { name: "B", x: 3.5, y: 0, label: "\\text{blue}", dir: "n" },
    { name: "W", x: 3.5, y: -3, label: "\\text{white}", dir: "s" },
    { name: "RJ", x: 7, y: 3.7, label: "\\text{red, jeans}", dir: "e" },
    { name: "RK", x: 7, y: 2.3, label: "\\text{red, khakis}", dir: "e" },
    { name: "BJ", x: 7, y: 0.7, label: "\\text{blue, jeans}", dir: "e" },
    { name: "BK", x: 7, y: -0.7, label: "\\text{blue, khakis}", dir: "e" },
    { name: "WJ", x: 7, y: -2.3, label: "\\text{white, jeans}", dir: "e" },
    { name: "WK", x: 7, y: -3.7, label: "\\text{white, khakis}", dir: "e" },
  ],
  segments: [
    { from: "O", to: "R", color: 1 },
    { from: "O", to: "B", color: 1 },
    { from: "O", to: "W", color: 1 },
    { from: "R", to: "RJ", color: 2 },
    { from: "R", to: "RK", color: 2 },
    { from: "B", to: "BJ", color: 2 },
    { from: "B", to: "BK", color: 2 },
    { from: "W", to: "WJ", color: 2 },
    { from: "W", to: "WK", color: 2 },
  ],
  labels: [
    { x: 1.6, y: 4.5, text: "\\text{shirt: 3}" },
    { x: 5.6, y: 4.5, text: "\\text{pants: 2 each}" },
  ],
  caption: md`Three shirts, then two pants for each shirt. Every path from start to a leaf is one outfit. The tree has 3 branches, each splitting into 2, so it has $3 \cdot 2 = 6$ leaves.`,
};

// ── Lesson 2: Permutations and combinations ────────────────────────────────

const pFormulaVerify = (n: number, k: number) => `x = ${n}!/(${n} - ${k})!`;
const cFormulaVerify = (n: number, k: number) => `x = ${n}!/(${k}! * (${n} - ${k})!)`;

/** Steps for C(n, k) = P(n, k) / k!, using the smaller of k and n - k. */
function chooseSteps(n: number, k: number): Step[] {
  const s = Math.min(k, n - k);
  const steps: Step[] = [];
  if (s !== k) steps.push({ math: md`\binom{${n}}{${k}} = \binom{${n}}{${s}}`, note: md`Choosing ${k} to take is the same as choosing the ${s} to leave behind, and ${s} is less work.` });
  if (s === 0) {
    steps.push({ math: "1", note: "There is exactly one way to choose nothing (or everything)." });
    return steps;
  }
  steps.push({ math: md`\binom{${n}}{${s}} = \frac{${fallTex(n, s)}}{${s}!}`, note: md`$P(${n}, ${s})$ ordered lists, divided by the $${s}!$ orders of each group.` });
  steps.push({ math: md`\frac{${big(nPr(n, s))}}{${fact(s)}} = ${big(nCr(n, s))}`, note: "" });
  return steps;
}

const evaluateCounts: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind <= 1) {
    const n = r.int(5, 12);
    const small = r.int(2, Math.min(4, n - 2));
    const k = kind === 0 ? small : n - small;
    return {
      prompt: md`Evaluate $\binom{${n}}{${k}}$. ${NUMBER}`,
      answer: String(nCr(n, k)),
      simplified: true,
      hint: md`$\binom{n}{r} = \frac{n!}{r!\,(n - r)!}$. Cancel the larger factorial in the bottom before multiplying anything.`,
      solution: chooseSteps(n, k),
    };
  }
  if (kind === 2) {
    const n = r.int(5, 12);
    const k = r.int(2, 4);
    return {
      prompt: md`Find $P(${n}, ${k})$, the number of ordered lists of ${k} objects chosen from ${n}. ${NUMBER}`,
      answer: String(nPr(n, k)),
      simplified: true,
      verify: [pFormulaVerify(n, k)],
      hint: md`Start at ${n} and multiply ${k} numbers, going down by one each time.`,
      solution: [
        { math: md`P(${n}, ${k}) = \frac{${n}!}{${n - k}!} = ${fallTex(n, k)}`, note: md`${k} positions: ${n} options for the first, one fewer for each one after.` },
        { math: big(nPr(n, k)), note: "" },
      ],
    };
  }
  const [a, b] = [r.int(4, 7), r.int(4, 7)];
  const [c, d] = [r.int(2, Math.min(3, a - 1)), r.int(1, Math.min(3, b - 1))];
  const value = nCr(a, c) * nCr(b, d);
  return {
    prompt: md`Evaluate $\binom{${a}}{${c}}\binom{${b}}{${d}}$. ${NUMBER}`,
    answer: String(value),
    simplified: true,
    hint: "Work out each binomial coefficient on its own, then multiply.",
    solution: [
      { math: md`\binom{${a}}{${c}} = \frac{${fallTex(a, c)}}{${c}!} = ${nCr(a, c)}`, note: "" },
      { math: md`\binom{${b}}{${d}} = ${d === 1 ? `${b}` : md`\frac{${fallTex(b, d)}}{${d}!} = ${nCr(b, d)}`}`, note: d === 1 ? "Choosing one of b things: b ways." : "" },
      { math: md`${nCr(a, c)} \cdot ${nCr(b, d)} = ${value}`, note: "" },
    ],
  };
};

interface Scenario {
  text: string;
  answer: number;
  verify: string;
  hint: string;
  steps: Step[];
}

/** Arrangements of letters with repeats: n! / (product of repeat counts!). */
const WORDS: [string, number[]][] = [
  ["LEVEL", [2, 2]],
  ["BANANA", [3, 2]],
  ["LLAMA", [2, 2]],
  ["COOKIE", [2]],
  ["PEPPER", [3, 2]],
  ["TOFFEE", [2, 2]],
  ["ALGEBRA", [2]],
  ["COFFEE", [2, 2]],
  ["ERROR", [3]],
];

function countingScenario(r: Rng): Scenario {
  const kind = r.int(0, 8);
  if (kind === 0 || kind === 1) {
    const n = r.int(6, 14);
    const text =
      kind === 0
        ? `A club has ${n} members. In how many ways can it choose a president, a vice president and a treasurer (three different people)?`
        : `${n} runners are in a race. In how many ways can the gold, silver and bronze medals be awarded (no ties)?`;
    return {
      text,
      answer: nPr(n, 3),
      verify: pFormulaVerify(n, 3),
      hint: "The three roles are different, so order matters. Fill them one at a time.",
      steps: [
        { math: md`P(${n}, 3) = ${fallTex(n, 3)}`, note: "Swapping two people's roles gives a different result, so this is a permutation." },
        { math: big(nPr(n, 3)), note: "" },
      ],
    };
  }
  if (kind === 2 || kind === 3) {
    const n = kind === 2 ? r.int(8, 15) : r.int(6, 12);
    const k = kind === 2 ? r.int(3, 5) : r.int(2, 4);
    const text =
      kind === 2
        ? `A committee of ${k} people, all with the same role, is chosen from ${n} volunteers. How many different committees are possible?`
        : `A pizza place offers ${n} toppings. How many different pizzas have exactly ${k} different toppings?`;
    return {
      text,
      answer: nCr(n, k),
      verify: cFormulaVerify(n, k),
      hint: "Only the group matters, not the order it was picked in. Count ordered lists, then divide by the orders of each group.",
      steps: [{ math: md`\binom{${n}}{${k}}`, note: "Rearranging the chosen group changes nothing, so this is a combination." }, ...chooseSteps(n, k)],
    };
  }
  if (kind === 4) {
    const n = r.int(5, 20);
    return {
      text: `${n} people are at a party, and every pair shakes hands exactly once. How many handshakes are there?`,
      answer: nCr(n, 2),
      verify: cFormulaVerify(n, 2),
      hint: "A handshake is a pair of people. Ann shaking Bo's hand is the same handshake as Bo shaking Ann's.",
      steps: [
        { math: md`\binom{${n}}{2} = \frac{${n} \cdot ${n - 1}}{2}`, note: "Each person shakes n - 1 hands, but that counts every handshake twice, once from each end." },
        { math: String(nCr(n, 2)), note: "" },
      ],
    };
  }
  if (kind === 5) {
    const n = r.int(6, 10);
    const k = r.int(3, 4);
    return {
      text: `${n} people arrive, and there are ${k} chairs in a row. In how many ways can ${k} of them be seated, left to right (the rest stand)?`,
      answer: nPr(n, k),
      verify: pFormulaVerify(n, k),
      hint: "The chairs are in different positions, so who sits where matters.",
      steps: [
        { math: md`P(${n}, ${k}) = ${fallTex(n, k)}`, note: "Fill the chairs left to right." },
        { math: big(nPr(n, k)), note: "" },
      ],
    };
  }
  if (kind === 6) {
    const [w, m] = [r.int(4, 8), r.int(4, 8)];
    const [a, b] = [r.int(2, 3), r.int(2, 3)];
    const value = nCr(w, a) * nCr(m, b);
    return {
      text: `A team of ${a + b} is chosen from ${w} juniors and ${m} seniors, and it must have exactly ${a} juniors and ${b} seniors. How many teams are possible?`,
      answer: value,
      verify: `x = ${w}!/(${a}! * ${w - a}!) * ${m}!/(${b}! * ${m - b}!)`,
      hint: "Choose the juniors, then choose the seniors. Two stages: multiply.",
      steps: [
        { math: md`\binom{${w}}{${a}} = ${nCr(w, a)}, \quad \binom{${m}}{${b}} = ${nCr(m, b)}`, note: "Each group is a combination: order inside the team doesn't matter." },
        { math: md`${nCr(w, a)} \cdot ${nCr(m, b)} = ${big(value)}`, note: "Every choice of juniors can go with every choice of seniors: the multiplication principle." },
      ],
    };
  }
  if (kind === 7) {
    const k = r.int(2, 5);
    return {
      text: `How many different ${k}-card hands can be dealt from a standard 52-card deck? (A hand is the same hand whatever order the cards arrive in.)`,
      answer: nCr(52, k),
      verify: cFormulaVerify(52, k),
      hint: "A hand is a group of cards. Order doesn't matter.",
      steps: [
        { math: md`\binom{52}{${k}} = \frac{${fallTex(52, k)}}{${k}!}`, note: "Ordered deals, divided by the orders of each hand." },
        { math: md`\frac{${big(nPr(52, k))}}{${fact(k)}} = ${big(nCr(52, k))}`, note: "" },
      ],
    };
  }
  const [word, reps] = r.pick(WORDS);
  const n = word.length;
  const value = fact(n) / reps.reduce((p, c) => p * fact(c), 1);
  const bottom = reps.map((c) => `${c}!`).join(" \\cdot ");
  return {
    text: `How many different arrangements of the letters of ${word} are there? (Arrangements that look the same count once.)`,
    answer: value,
    verify: `x = ${n}!/(${reps.map((c) => `${c}!`).join(" * ")})`,
    hint: "Pretend the repeated letters are different (give them colors), count, then divide out the swaps of identical letters.",
    steps: [
      { math: md`${n}! = ${big(fact(n))}`, note: "Arrangements if all the letters were different." },
      { math: md`\frac{${n}!}{${bottom}} = \frac{${big(fact(n))}}{${reps.reduce((p, c) => p * fact(c), 1)}} = ${big(value)}`, note: "Each visible arrangement was counted once for every way of shuffling the identical letters among themselves." },
    ],
  };
}

const countingWordProblems: Generator = (r) => {
  const s = countingScenario(r);
  return {
    prompt: md`${s.text} ${COUNT}`,
    answer: String(s.answer),
    verify: [s.verify],
    hint: s.hint,
    solution: s.steps,
  };
};

const PERM = "Permutation: order matters";
const COMB = "Combination: order doesn't matter";

const permutationOrCombination: Generator = (r) => {
  const n = r.int(8, 15);
  const k = r.int(3, 5);
  const perms: [string, number, number][] = [
    [`A club of ${n} members elects a president, a secretary and a treasurer.`, n, 3],
    [`${n} horses run a race. Count the possible first, second and third place finishes.`, n, 3],
    [`A lock code uses ${k} different digits, and 1-2-3 is a different code from 3-2-1.`, 10, k],
    [`${k} of ${n} students are lined up left to right for a photo.`, n, k],
    [`A playlist plays ${k} of your ${n} favorite songs, one after another.`, n, k],
    [`${k} different prizes (first prize, second prize, and so on) are given to ${k} of ${n} people, at most one each.`, n, k],
  ];
  const combs: [string, number, number][] = [
    [`A teacher picks ${k} of ${n} students to help clean up.`, n, k],
    [`A pizza gets ${k} different toppings from a list of ${n}.`, n, k],
    [`You pack ${k} of your ${n} books for a trip.`, n, k],
    [`A hand of ${k} cards is dealt from a deck of 52.`, 52, k],
    [`${n} people each shake hands once with every other person. Count the handshakes.`, n, 2],
    [`A committee of ${k} equal members is formed from ${n} volunteers.`, n, k],
    [`A lottery ticket marks ${k} numbers out of ${n}. The order you mark them doesn't matter.`, n, k],
  ];
  const isPerm = r.next() < 0.5;
  const [text, nn, kk] = isPerm ? r.pick(perms) : r.pick(combs);
  return {
    prompt: md`Is this counted by a permutation or a combination? ${text}`,
    choices: [PERM, COMB],
    accept: [isPerm ? PERM : COMB],
    hint: "Take one outcome and swap two of the chosen items. If that gives a different outcome, order matters.",
    solution: isPerm
      ? [
          { math: md`\text{${PERM}}`, note: "Swapping two of the chosen items (two roles, two places, two positions) gives a different outcome." },
          { math: md`P(${nn}, ${kk}) = ${fallTex(nn, kk)} = ${big(nPr(nn, kk))}`, note: "The count, for the record." },
        ]
      : [
          { math: md`\text{${COMB}}`, note: "Swapping two of the chosen items leaves the same group, so only the group matters." },
          { math: md`\binom{${nn}}{${kk}} = ${big(nCr(nn, kk))}`, note: "The count, for the record." },
        ],
  };
};

// ── Lesson 3: The binomial theorem ──────────────────────────────────────────

/** Pascal's triangle rows 0..n as a centered KaTeX array. */
function pascalTex(rows: number): string {
  const lines = Array.from({ length: rows + 1 }, (_, n) => `\\text{row } ${n}: & ${Array.from({ length: n + 1 }, (_, k) => nCr(n, k)).join(" \\quad ")}`);
  return `\\begin{array}{r c} ${lines.join(" \\\\ ")} \\end{array}`;
}

/** Expand (a x + b y-or-1)^n. `second` is the variable on b ("" for a constant). */
function binomialTerms(a: number, b: number, n: number, second: "" | "y"): [number, string][] {
  return Array.from({ length: n + 1 }, (_, j): [number, string] => [nCr(n, j) * a ** (n - j) * b ** j, second ? mono(n - j, j) : pow("x", n - j)]);
}

const expandBinomial: Generator = (r) => {
  const kind = r.int(0, 2);
  let a = 1;
  let b: number;
  let n: number;
  const second: "" | "y" = kind === 2 ? "y" : "";
  if (kind === 0) {
    n = r.int(3, 5);
    b = r.pick([1, 2, 3, -1, -2, -3]);
  } else if (kind === 1) {
    n = r.int(3, 4);
    a = r.pick([2, 3]);
    b = r.pick([1, 2, -1, -2].filter((v) => gcd(a, v) === 1));
  } else {
    n = r.int(3, 4);
    b = r.pick([1, 2, -1, -2]);
  }
  const firstTex = a === 1 ? "x" : `${a}x`;
  const secondTex = poly([[b, second]]);
  const binom = `(${poly([[a, "x"], [b, second]])})^${n}`;
  const row = Array.from({ length: n + 1 }, (_, j) => nCr(n, j));
  const termTex = row.map((c, j) => {
    const parts: string[] = [];
    if (c !== 1) parts.push(String(c));
    if (n - j > 0) parts.push(a === 1 ? pow("x", n - j) : `(${firstTex})${n - j > 1 ? `^${n - j}` : ""}`);
    if (j > 0) parts.push(`(${secondTex})${j > 1 ? `^${j}` : ""}`);
    return parts.join("");
  });
  const answer = poly(binomialTerms(a, b, n, second));
  return {
    prompt: md`Expand $${binom}$. Write it as a sum of terms with no parentheses.`,
    answer,
    expanded: true,
    simplified: true,
    hint: md`The coefficients come from row ${n} of Pascal's triangle: ${row.join(", ")}. The power of $${firstTex}$ counts down from ${n} while the power of $${secondTex}$ counts up.${b < 0 ? md` Keep the sign with $${secondTex}$: odd powers of it are negative.` : ""}`,
    solution: [
      { math: row.join(",\\; "), note: md`Row ${n} of Pascal's triangle: $\binom{${n}}{0}, \binom{${n}}{1}, \dots, \binom{${n}}{${n}}$.` },
      { math: termTex.join(" + "), note: md`Term $k$ takes $${secondTex}$ from $k$ of the ${n} factors and $${firstTex}$ from the rest, in $\binom{${n}}{k}$ ways.` },
      { math: answer, note: "Work out each power and multiply." },
    ],
  };
};

const binomialCoefficient: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 2) {
    const n = r.int(5, 10);
    const q = r.int(2, n - 2);
    const p = n - q;
    return {
      prompt: md`Find the coefficient of $${mono(p, q)}$ in the expansion of $(x + y)^{${n}}$. ${NUMBER}`,
      answer: String(nCr(n, q)),
      verify: [`c = ${n}!/(${q}! * ${p}!)`],
      hint: md`A term $${mono(p, q)}$ comes from choosing $y$ in ${q} of the ${n} factors (and $x$ in the rest). How many ways can you pick those ${q} factors?`,
      solution: [
        { math: md`\binom{${n}}{${q}}`, note: md`Pick which ${q} of the ${n} factors $(x + y)$ give a $y$.` },
        ...chooseSteps(n, q).filter((s) => s.math !== "1"),
      ],
    };
  }
  const a = kind === 0 ? 1 : r.pick([2, 3]);
  const b = kind === 0 ? r.pick([1, 2, 3, -1, -2, -3]) : r.pick([1, 2, 3, -1, -2, -3].filter((v) => gcd(a, v) === 1));
  const n = kind === 0 ? r.int(5, 8) : r.int(4, 6);
  const k = r.int(1, n - 1);
  const choose = nCr(n, k);
  const value = choose * a ** k * b ** (n - k);
  const xk = pow("x", k);
  const firstTex = a === 1 ? "x" : `${a}x`;
  const binom = `(${poly([[a, "x"], [b, ""]])})^${n}`;
  return {
    prompt: md`Find the coefficient of $${xk}$ in the expansion of $${binom}$. ${INTEGER}`,
    answer: String(value),
    verify: [`c = ${n}!/(${k}! * ${n - k}!) * (${a})^${k} * (${b})^${n - k}`],
    hint: md`To get $${xk}$, take $${firstTex}$ from ${k} of the ${n} factors and $${b}$ from the ${n - k === 1 ? "one" : n - k} left over. ${a === 1 ? "Raise the constant to its power, sign included." : md`Raise both $${a}$ and $${b}$ to their powers.`}`,
    solution: [
      { math: md`\binom{${n}}{${k}}(${firstTex})^{${k}}(${b})^{${n - k}}`, note: md`The only term with $${xk}$: choose ${k === 1 ? "the one factor" : `the ${k} factors`} that give${k === 1 ? "s" : ""} $${firstTex}$.` },
      {
        math: [String(choose), ...(a === 1 ? [] : [String(a ** k)]), par(b ** (n - k))].join(" \\cdot "),
        note: md`$\binom{${n}}{${k}} = ${choose}$, ${a === 1 ? "" : md`$${a}^{${k}} = ${a ** k}$, `}and $${par(b)}^{${n - k}} = ${b ** (n - k)}$.`,
      },
      { math: String(value), note: md`So the term is $${value}${xk}$.` },
    ],
  };
};

const pascalAndSums: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const n = r.int(6, 12);
    const k = r.int(2, n - 2);
    const [left, right] = [nCr(n, k - 1), nCr(n, k)];
    return {
      prompt: md`In Pascal's triangle, $\binom{${n}}{${k - 1}} = ${left}$ and $\binom{${n}}{${k}} = ${right}$. Use Pascal's rule to find $\binom{${n + 1}}{${k}}$. ${NUMBER}`,
      answer: String(left + right),
      verify: [`x = ${left} + ${right}`],
      hint: "Each entry is the sum of the two entries just above it.",
      solution: [
        { math: md`\binom{${n + 1}}{${k}} = \binom{${n}}{${k - 1}} + \binom{${n}}{${k}}`, note: "Pascal's rule." },
        { math: md`${left} + ${right} = ${left + right}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const n = r.int(5, 12);
    return {
      prompt: md`What is the sum of all the numbers in row ${n} of Pascal's triangle, $\binom{${n}}{0} + \binom{${n}}{1} + \dots + \binom{${n}}{${n}}$? ${NUMBER}`,
      answer: String(2 ** n),
      verify: [`s = 2^${n}`],
      hint: md`Set $x = y = 1$ in $(x + y)^{${n}}$. Or: each $\binom{${n}}{k}$ counts the subsets with $k$ elements of a set with ${n} elements.`,
      solution: [
        { math: md`(1 + 1)^{${n}} = \sum_{k=0}^{${n}} \binom{${n}}{k} 1^{${n} - k} 1^k`, note: "The binomial theorem with both terms equal to 1. Every power of 1 is 1." },
        { math: md`2^{${n}} = ${big(2 ** n)}`, note: "" },
      ],
    };
  }
  const a = r.pick([1, 2, 3]);
  const b = r.pick([1, 2, -1, -2, -3].filter((v) => v !== -a));
  const n = r.int(3, 5);
  const binom = `(${poly([[a, "x"], [b, ""]])})^${n}`;
  return {
    prompt: md`Without expanding, find the sum of all the coefficients in the expansion of $${binom}$. ${INTEGER}`,
    answer: String((a + b) ** n),
    verify: [`s = (${a} + ${b})^${n}`],
    hint: md`If the expansion is $c_${n}x^${n} + \dots + c_1x + c_0$, what do you get when $x = 1$?`,
    solution: [
      { math: md`c_${n} + c_${n - 1} + \dots + c_0 = ${binom.replace("x", "(1)")}`, note: md`At $x = 1$ every power of $x$ is 1, so the expansion becomes the sum of its coefficients.` },
      { math: md`${par(a + b)}^${n} = ${(a + b) ** n}`, note: "" },
    ],
  };
};

// ── Lesson 4: Probability basics ────────────────────────────────────────────

/** A probability problem with a hidden check that p = count/total. */
function probProblem(prompt: string, num: number, den: number, verify: string, hint: string, solution: Step[]): Problem {
  return { prompt: `${prompt} ${PROB}`, answer: frac(num, den), simplified: true, verify: [verify], hint, solution };
}

const reduceStep = (num: number, den: number, note = ""): Step => ({
  math: gcd(num, den) > 1 ? md`\frac{${num}}{${den}} = ${fracTex(num, den)}` : fracTex(num, den),
  note: note || (gcd(num, den) > 1 ? `Reduce: divide top and bottom by ${gcd(num, den)}.` : "Already in lowest terms."),
});

const DECK = "A card is drawn at random from a standard 52-card deck: 4 suits (hearts, diamonds, clubs, spades) of 13 cards each (ace, 2 through 10, jack, queen, king). Hearts and diamonds are red; clubs and spades are black.";

const CARD_EVENTS: [string, number, string][] = [
  ["a heart", 13, "One suit: 13 cards."],
  ["a red card", 26, "Two red suits of 13."],
  ["a face card (jack, queen or king)", 12, "3 face cards in each of 4 suits."],
  ["an ace", 4, "One ace per suit."],
  ["a red face card", 6, "3 face cards in each of the 2 red suits."],
  ["a king or a queen", 8, "4 kings and 4 queens, and no card is both."],
  ["a number card (2 through 10)", 36, "9 number cards in each of 4 suits."],
];

const basicProbability: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const t = r.int(1, 4);
    const events: [string, number[]][] = [
      ["an even number", [2, 4, 6]],
      [`a number greater than ${t}`, [1, 2, 3, 4, 5, 6].filter((v) => v > t)],
      ["a prime number", [2, 3, 5]],
      ["a multiple of 3", [3, 6]],
      [`a number at most ${t + 1}`, [1, 2, 3, 4, 5, 6].filter((v) => v <= t + 1)],
    ];
    const [what, outcomes] = r.pick(events);
    return probProblem(md`A fair six-sided die is rolled. What is the probability of rolling ${what}?`, outcomes.length, 6, `p = ${outcomes.length}/6`, "List the outcomes that count. There are 6 equally likely outcomes in all.", [
      { math: md`E = \{${outcomes.join(", ")}\}`, note: "The outcomes in the event." },
      { math: md`P(E) = \frac{${outcomes.length}}{6}`, note: "Favorable outcomes over all outcomes." },
      reduceStep(outcomes.length, 6),
    ]);
  }
  if (kind === 1) {
    const [what, count, why] = r.pick(CARD_EVENTS);
    return probProblem(md`${DECK} What is the probability that it is ${what}?`, count, 52, `p = ${count}/52`, "Count the cards that fit, out of 52 equally likely cards.", [
      { math: md`|E| = ${count}`, note: why },
      { math: md`P = \frac{${count}}{52}`, note: "" },
      reduceStep(count, 52),
    ]);
  }
  if (kind === 2) {
    const [red, blue, green] = [r.int(2, 9), r.int(2, 9), r.int(2, 6)];
    const n = red + blue + green;
    const not = r.next() < 0.5;
    const count = not ? n - blue : red;
    return probProblem(
      md`A bag holds ${red} red, ${blue} blue and ${green} green marbles. One marble is drawn at random. What is the probability that it is ${not ? "**not** blue" : "red"}?`,
      count,
      n,
      not ? `p = 1 - ${blue}/${n}` : `p = ${red}/${n}`,
      not ? md`Find the probability that it *is* blue, and subtract from 1.` : "Each marble is one equally likely outcome. How many marbles are there in all?",
      not
        ? [
            { math: md`P(\text{blue}) = \frac{${blue}}{${n}}`, note: md`${n} marbles in all.` },
            { math: md`P(\text{not blue}) = 1 - \frac{${blue}}{${n}} = \frac{${n - blue}}{${n}}`, note: "Complement rule." },
            reduceStep(count, n),
          ]
        : [{ math: md`P(\text{red}) = \frac{${red}}{${red} + ${blue} + ${green}} = \frac{${red}}{${n}}`, note: "Favorable over total." }, reduceStep(count, n)],
    );
  }
  const N = r.pick([20, 30, 40, 50, 60, 100]);
  const square = r.next() < 0.25;
  const k = r.int(2, 9);
  const count = square ? Math.floor(Math.sqrt(N)) : Math.floor(N / k);
  return probProblem(
    md`A whole number from 1 to ${N} is chosen at random, each equally likely. What is the probability that it is ${square ? "a perfect square" : `a multiple of ${k}`}?`,
    count,
    N,
    `p = ${count}/${N}`,
    square ? "List the squares 1, 4, 9, ... up to the limit." : md`The multiples of ${k} are $${k}, ${2 * k}, ${3 * k}, \dots$. How many are at most ${N}?`,
    [
      square
        ? { math: md`1^2, 2^2, \dots, ${count}^2 = ${count * count}`, note: md`$${count + 1}^2 = ${(count + 1) ** 2}$ is too big, so there are ${count}.` }
        : { math: md`${k} \cdot 1, \; ${k} \cdot 2, \; \dots, \; ${k} \cdot ${count} = ${k * count}`, note: md`$${k} \cdot ${count + 1} = ${k * (count + 1)}$ is past ${N}, so there are ${count}.` },
      { math: md`P = \frac{${count}}{${N}}`, note: "" },
      reduceStep(count, N),
    ],
  );
};

/** All 36 ordered rolls of two dice. */
const ROLLS: [number, number][] = Array.from({ length: 36 }, (_, i) => [Math.floor(i / 6) + 1, (i % 6) + 1]);

const complementAndAddition: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const s = r.int(3, 11);
    const t = r.int(8, 11);
    const events: [string, (a: number, b: number) => boolean, string][] = [
      [`the sum is ${s}`, (a, b) => a + b === s, `Pairs (first, second) that add to ${s}.`],
      [`the sum is at least ${t}`, (a, b) => a + b >= t, `Pairs whose sum is ${t} or more.`],
      ["the two dice show the same number", (a, b) => a === b, "Doubles: (1, 1) through (6, 6)."],
      ["at least one die shows a 6", (a, b) => a === 6 || b === 6, "Row 6 and column 6 of the grid, sharing the corner (6, 6)."],
      ["the sum is even", (a, b) => (a + b) % 2 === 0, "Both even or both odd: 9 + 9 pairs."],
    ];
    const [what, test, why] = r.pick(events);
    const hits = ROLLS.filter(([a, b]) => test(a, b));
    const list = hits.length <= 6 ? hits.map(([a, b]) => `(${a}, ${b})`).join(", ") : `${hits.length} \\text{ pairs}`;
    return probProblem(md`Two fair dice, one red and one blue, are rolled. What is the probability that ${what}?`, hits.length, 36, `p = ${hits.length}/36`, "There are 6 · 6 = 36 equally likely ordered pairs. (2, 5) and (5, 2) are different outcomes.", [
      { math: list, note: why },
      { math: md`P = \frac{${hits.length}}{36}`, note: "Out of 36 equally likely pairs." },
      reduceStep(hits.length, 36),
    ]);
  }
  if (kind === 1) {
    const coin = r.next() < 0.5;
    const n = coin ? r.int(2, 6) : r.int(2, 3);
    const [q, d] = coin ? [1, 2] : [5, 6];
    const den = d ** n;
    const none = q ** n;
    return probProblem(
      coin ? md`A fair coin is flipped ${n} times. What is the probability of getting **at least one** head?` : md`A fair die is rolled ${n} times. What is the probability of rolling **at least one** 6?`,
      den - none,
      den,
      `p = 1 - (${q}/${d})^${n}`,
      coin ? "The opposite of at least one head is all tails." : "The opposite of at least one 6 is no 6 at all.",
      [
        { math: md`P(\text{none}) = \left(\frac{${q}}{${d}}\right)^{${n}} = \frac{${none}}{${den}}`, note: md`Each ${coin ? "flip" : "roll"} misses with probability $\frac{${q}}{${d}}$, and the ${coin ? "flips" : "rolls"} are independent, so multiply.` },
        { math: md`P(\text{at least one}) = 1 - \frac{${none}}{${den}} = \frac{${den - none}}{${den}}`, note: "Complement rule." },
        reduceStep(den - none, den),
      ],
    );
  }
  if (kind === 2) {
    const pairs: [string, number, string, number, number, string][] = [
      ["a heart", 13, "a face card", 12, 3, "the jack, queen and king of hearts"],
      ["a red card", 26, "an ace", 4, 2, "the two red aces"],
      ["a club", 13, "a king", 4, 1, "the king of clubs"],
      ["a spade", 13, "a face card", 12, 3, "the jack, queen and king of spades"],
      ["a black card", 26, "a queen", 4, 2, "the two black queens"],
      ["a diamond", 13, "a number card from 2 to 10", 36, 9, "the nine number cards in diamonds"],
    ];
    const [A, a, B, b, both, which] = r.pick(pairs);
    const count = a + b - both;
    return probProblem(md`${DECK} What is the probability that it is ${A} or ${B} (or both)?`, count, 52, `p = ${a}/52 + ${b}/52 - ${both}/52`, md`Add the two probabilities, then subtract the cards you counted twice.`, [
      { math: md`P(A) + P(B) = \frac{${a}}{52} + \frac{${b}}{52}`, note: md`$A$ = ${A}, $B$ = ${B}.` },
      { math: md`P(A \text{ and } B) = \frac{${both}}{52}`, note: md`Counted twice: ${which}.` },
      { math: md`\frac{${a} + ${b} - ${both}}{52} = \frac{${count}}{52}`, note: "Addition rule." },
      reduceStep(count, 52),
    ]);
  }
  const N = r.pick([20, 24, 30, 36, 40, 50, 60]);
  const [a, b] = r.pick([[2, 3], [2, 5], [3, 5], [3, 4], [4, 6], [2, 7], [3, 7]] as [number, number][]);
  const l = (a * b) / gcd(a, b);
  const [A, B, AB] = [Math.floor(N / a), Math.floor(N / b), Math.floor(N / l)];
  const count = A + B - AB;
  return probProblem(
    md`A whole number from 1 to ${N} is chosen at random. What is the probability that it is a multiple of ${a} or a multiple of ${b} (or both)?`,
    count,
    N,
    `p = ${A}/${N} + ${B}/${N} - ${AB}/${N}`,
    md`Count multiples of ${a}, multiples of ${b}, and the numbers counted twice: multiples of both, which are the multiples of ${l}.`,
    [
      { math: md`${A} + ${B}`, note: md`There are ${A} multiples of ${a} and ${B} multiples of ${b} from 1 to ${N}.` },
      { math: md`${A} + ${B} - ${AB} = ${count}`, note: md`A multiple of both ${a} and ${b} is a multiple of ${l}. There are ${AB} of those, each counted twice.` },
      { math: md`P = \frac{${count}}{${N}}`, note: "" },
      reduceStep(count, N),
    ],
  );
};

const independenceAndConditional: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const t = r.int(1, 4);
    const coinEvent = r.pick(["heads", "tails"]);
    const dieCount = 6 - t;
    return probProblem(
      md`A fair coin is flipped and a fair die is rolled. What is the probability of ${coinEvent} **and** a number greater than ${t}?`,
      dieCount,
      12,
      `p = (1/2) * (${dieCount}/6)`,
      "The coin can't influence the die. For independent events, multiply.",
      [
        { math: md`P(\text{${coinEvent}}) = \frac{1}{2}, \quad P(\text{die} > ${t}) = \frac{${dieCount}}{6}`, note: "Each on its own." },
        { math: md`\frac{1}{2} \cdot \frac{${dieCount}}{6} = \frac{${dieCount}}{12}`, note: "Independent, so multiply. Check by counting: 12 equally likely (coin, die) pairs." },
        reduceStep(dieCount, 12),
      ],
    );
  }
  if (kind === 1) {
    const [red, blue] = [r.int(3, 7), r.int(2, 6)];
    const n = red + blue;
    const mixed = r.next() < 0.4;
    const num = mixed ? 2 * red * blue : red * (red - 1);
    const den = n * (n - 1);
    return probProblem(
      md`A bag holds ${red} red and ${blue} blue marbles. Two are drawn at random, one after the other, **without** putting the first back. What is the probability that ${mixed ? "one is red and one is blue" : "both are red"}?`,
      num,
      den,
      mixed ? `p = (${red}/${n})(${blue}/${n - 1}) + (${blue}/${n})(${red}/${n - 1})` : `p = (${red}/${n})(${red - 1}/${n - 1})`,
      mixed ? "Two orders: red then blue, or blue then red. Find each and add." : "After a red marble is taken, the bag has one fewer red and one fewer marble.",
      mixed
        ? [
            { math: md`P(\text{red, then blue}) = \frac{${red}}{${n}} \cdot \frac{${blue}}{${n - 1}}`, note: "The second draw is conditional on the first: one marble is gone." },
            { math: md`P(\text{blue, then red}) = \frac{${blue}}{${n}} \cdot \frac{${red}}{${n - 1}}`, note: "" },
            { math: md`\frac{${red * blue} + ${red * blue}}{${den}} = \frac{${num}}{${den}}`, note: "The two orders can't both happen, so add." },
            reduceStep(num, den),
          ]
        : [
            { math: md`P(\text{1st red}) = \frac{${red}}{${n}}, \quad P(\text{2nd red} \mid \text{1st red}) = \frac{${red - 1}}{${n - 1}}`, note: "One red is gone before the second draw." },
            { math: md`\frac{${red}}{${n}} \cdot \frac{${red - 1}}{${n - 1}} = \frac{${num}}{${den}}`, note: md`Same as $\binom{${red}}{2} \big/ \binom{${n}}{2}$: red pairs over all pairs.` },
            reduceStep(num, den),
          ],
    );
  }
  if (kind === 2) {
    const [a, b, c, d] = [r.int(4, 20), r.int(4, 20), r.int(4, 20), r.int(4, 20)];
    const given11 = r.next() < 0.5;
    const [hit, rowTotal, grade] = given11 ? [c, c + d, 11] : [a, a + b, 10];
    const table = md`$$\begin{array}{l|cc|c} & \text{plays a sport} & \text{does not} & \text{total} \\ \hline \text{grade 10} & ${a} & ${b} & ${a + b} \\ \text{grade 11} & ${c} & ${d} & ${c + d} \end{array}$$`;
    return probProblem(
      md`The table shows the students in a club. ${table} A student is chosen at random. Given that the student is in grade ${grade}, what is the probability that they play a sport?`,
      hit,
      rowTotal,
      `p = ${hit}/(${hit} + ${rowTotal - hit})`,
      md`"Given grade ${grade}" means only the grade ${grade} row is the sample space now.`,
      [
        { math: md`|\text{grade ${grade}}| = ${hit} + ${rowTotal - hit} = ${rowTotal}`, note: "The new sample space." },
        { math: md`P(\text{sport} \mid \text{grade ${grade}}) = \frac{${hit}}{${rowTotal}}`, note: "Of those, the ones who play a sport." },
        reduceStep(hit, rowTotal),
      ],
    );
  }
  if (kind === 3) {
    const [w, m] = [r.int(4, 7), r.int(3, 6)];
    const k = r.int(2, 3);
    const n = w + m;
    const [num, den] = [nCr(w, k), nCr(n, k)];
    return probProblem(
      md`A committee of ${k} is chosen at random from ${w} juniors and ${m} seniors. What is the probability that every member is a junior?`,
      num,
      den,
      `p = (${w}!/(${k}! * ${w - k}!)) / (${n}!/(${k}! * ${n - k}!))`,
      "Every committee is equally likely. Count the all-junior committees, and all committees.",
      [
        { math: md`\binom{${n}}{${k}} = ${den}`, note: md`All committees of ${k} from ${n} people.` },
        { math: md`\binom{${w}}{${k}} = ${num}`, note: "Committees chosen only from the juniors." },
        { math: md`P = \frac{${num}}{${den}}`, note: "" },
        reduceStep(num, den),
      ],
    );
  }
  const s = r.int(3, 11);
  const given = ROLLS.filter(([a, b]) => a + b === s);
  const hits = given.filter(([a]) => a % 2 === 0);
  return probProblem(
    md`Two fair dice, one red and one blue, are rolled. Given that the sum is ${s}, what is the probability that the red die shows an even number?`,
    hits.length,
    given.length,
    `p = ${hits.length}/${given.length}`,
    md`Knowing the sum is ${s} shrinks the sample space to the pairs that add to ${s}. List them as (red, blue).`,
    [
      { math: given.map(([a, b]) => `(${a}, ${b})`).join(", "), note: md`All ${given.length} pairs with sum ${s}: the new sample space.` },
      { math: md`${hits.length} \text{ of them have an even red die}`, note: hits.map(([a, b]) => `(${a}, ${b})`).join(", ") },
      { math: md`P = \frac{${hits.length}}{${given.length}}`, note: "" },
      reduceStep(hits.length, given.length),
    ],
  );
};

/** The 6 × 6 grid of two-dice outcomes, with sum 7 highlighted. */
const diceGrid: DiagramSpec = {
  view: [-0.9, 7.2, -0.9, 7.2],
  points: [
    ...ROLLS.map(([a, b]) => ({ name: `D${a}${b}`, x: a, y: b, label: "" })),
    { name: "H1", x: 0.85, y: 6.65, hidden: true, label: "" },
    { name: "H2", x: 6.65, y: 0.85, hidden: true, label: "" },
    { name: "H3", x: 6.15, y: 0.35, hidden: true, label: "" },
    { name: "H4", x: 0.35, y: 6.15, hidden: true, label: "" },
  ],
  polygons: [{ points: ["H1", "H2", "H3", "H4"], fill: 2 }],
  labels: [
    ...[1, 2, 3, 4, 5, 6].map((v) => ({ x: v, y: 0.25, text: String(v) })),
    ...[1, 2, 3, 4, 5, 6].map((v) => ({ x: 0.25, y: v, text: String(v) })),
    { x: 3.5, y: -0.45, text: "\\text{red die}" },
    { x: -0.55, y: 3.5, text: "\\text{blue}" },
  ],
  caption: md`Each dot is one equally likely outcome (red, blue). The shaded band holds the 6 outcomes with sum 7: $(1, 6), (2, 5), \dots, (6, 1)$. So $P(\text{sum } 7) = \frac{6}{36} = \frac{1}{6}$.`,
};

/** Venn diagram for hearts and face cards. */
const vennDiagram: DiagramSpec = {
  view: [-4.6, 4.6, -3.2, 3.2],
  points: [
    { name: "A", x: -1.2, y: 0, hidden: true, label: "" },
    { name: "B", x: 1.2, y: 0, hidden: true, label: "" },
    { name: "S1", x: -4.3, y: -2.9, hidden: true, label: "" },
    { name: "S2", x: 4.3, y: -2.9, hidden: true, label: "" },
    { name: "S3", x: 4.3, y: 2.9, hidden: true, label: "" },
    { name: "S4", x: -4.3, y: 2.9, hidden: true, label: "" },
  ],
  polygons: [{ points: ["S1", "S2", "S3", "S4"] }],
  circles: [
    { center: "A", radius: 2, color: 1, fill: 1 },
    { center: "B", radius: 2, color: 2, fill: 2 },
  ],
  labels: [
    { x: -2.6, y: 2.2, text: "\\text{hearts}" },
    { x: 2.6, y: 2.2, text: "\\text{face cards}" },
    { x: -2, y: 0, text: "10" },
    { x: 0, y: 0, text: "3" },
    { x: 2, y: 0, text: "9" },
    { x: 3.7, y: -2.4, text: "30" },
    { x: -3.9, y: -2.5, text: "S" },
  ],
  caption: md`The 52 cards. 13 hearts, 12 face cards, and 3 cards (the heart jack, queen and king) in both. Adding $13 + 12$ counts the middle 3 twice, so the circles together hold $13 + 12 - 3 = 22$ cards. The 30 outside are neither.`,
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit8: Unit = {
  title: "Counting and Probability",
  lessons: [
    {
      id: "counting-principles",
      title: "Counting principles",
      summary: "Counting without listing: the multiplication principle, the addition principle, factorials, and counting the opposite.",
      blocks: [
        {
          kind: "text",
          body: md`How many outfits can you make from 3 shirts and 2 pairs of pants? You could list them. How many license plates can a state issue? Listing is hopeless: there are millions.

This unit is about counting things without listing them. It sounds like a small skill, but it carries a lot. Probability, at the end of the unit, is mostly counting. So is the binomial theorem, which expands $(a + b)^n$ for any $n$.

Two simple principles do almost all the work. Start with the outfits.`,
        },
        { kind: "diagram", ...treeDiagram },
        {
          kind: "key",
          title: "The multiplication principle",
          body: md`If a task happens in stages, with $m$ options for the first stage and $n$ options for the second **whatever was chosen first**, then the whole task can be done in $m \cdot n$ ways.

With more stages, keep multiplying: $n_1 \cdot n_2 \cdot n_3 \cdots$.`,
        },
        {
          kind: "why",
          title: "Why multiply?",
          body: md`Look at the tree. Each of the $m$ first choices starts its own branch, and each branch splits into $n$ second choices. So the leaves come in $m$ groups of $n$. Counting $m$ groups of $n$ is $n + n + \dots + n$ ($m$ times), and repeated addition is exactly what $m \cdot n$ means (Algebra 1, Unit 1).

For a third stage, every one of those $mn$ leaves splits again into $n_3$ branches, so you multiply once more.

The condition in bold matters. The **number** of options at a stage must not depend on earlier choices, even if the options themselves do. In a code with no repeated digits, the second digit always has 9 options, though which 9 depends on the first.`,
        },
        {
          kind: "example",
          title: "License plates",
          problem: md`A plate has 3 letters followed by 3 digits. How many plates are possible if repeats are allowed? How many if no letter and no digit repeats?`,
          steps: [
            { math: md`26 \cdot 26 \cdot 26 \cdot 10 \cdot 10 \cdot 10`, note: "Six stages. With repeats, every letter position has 26 options and every digit position has 10." },
            { math: md`26^3 \cdot 10^3 = 17{,}576{,}000`, note: "" },
            { math: md`26 \cdot 25 \cdot 24 \cdot 10 \cdot 9 \cdot 8 = 11{,}232{,}000`, note: "Without repeats, each choice uses up an option for the later positions of its kind." },
          ],
        },
        {
          kind: "key",
          title: "Factorials",
          body: md`For a whole number $n \ge 1$, **$n$ factorial** is

$$n! = n \cdot (n - 1) \cdot (n - 2) \cdots 2 \cdot 1,$$

and $0! = 1$. For example $4! = 24$ and $5! = 120$.

$n!$ is the number of ways to arrange $n$ different objects in a row.`,
        },
        {
          kind: "why",
          title: "Why n! counts arrangements, and why 0! = 1",
          body: md`Fill the row one position at a time. The first position can hold any of the $n$ objects. The second can hold any of the $n - 1$ that are left, and so on, until one object is left for the last position. By the multiplication principle the count is $n(n - 1) \cdots 1 = n!$.

Every factorial contains the one below it: $n! = n \cdot (n - 1)!$. That is what makes $\frac{10!}{7!}$ easy: $10! = 10 \cdot 9 \cdot 8 \cdot 7!$, so $\frac{10!}{7!} = 10 \cdot 9 \cdot 8 = 720$.

Now put $n = 1$ in $n! = n \cdot (n - 1)!$. It says $1! = 1 \cdot 0!$, and $1! = 1$, so the only value that keeps the rule working is $0! = 1$. It also fits the counting meaning: there is exactly one way to arrange nothing, which is to do nothing.`,
        },
        {
          kind: "key",
          title: "The addition principle",
          body: md`If the outcomes split into cases that **don't overlap**, the total is the sum of the cases.

A useful special case is **counting the opposite** (the complement):

$$\text{(number with the property)} = \text{(total)} - \text{(number without it)}.$$`,
        },
        {
          kind: "why",
          title: "Why the complement works",
          body: md`Every outcome either has the property or doesn't, and none does both. So "with" and "without" are two non-overlapping cases that make up everything. By the addition principle, with + without = total. Subtract "without" from both sides.

It helps most with "at least one" questions. "At least one repeat" splits into many messy cases. Its opposite, "no repeats", is a single multiplication.`,
        },
        {
          kind: "example",
          title: "At least one repeated digit",
          problem: md`How many 4-digit PINs (0 to 9, repeats allowed) have at least one repeated digit?`,
          steps: [
            { math: md`10^4 = 10{,}000`, note: "All PINs." },
            { math: md`10 \cdot 9 \cdot 8 \cdot 7 = 5040`, note: "PINs with no repeated digit." },
            { math: md`10{,}000 - 5040 = 4960`, note: "Total minus the ones without a repeat." },
          ],
        },
        {
          kind: "proof",
          title: "A set with n elements has 2ⁿ subsets",
          given: md`A set $S$ with $n$ elements $a_1, a_2, \dots, a_n$.`,
          prove: md`$S$ has exactly $2^n$ subsets (counting the empty set and $S$ itself).`,
          steps: [
            { statement: md`Build a subset by going through $a_1, \dots, a_n$ in order and deciding **in** or **out** for each.`, reason: "Each subset gives exactly one list of decisions, and each list of decisions gives exactly one subset" },
            { statement: md`Each decision has 2 options, whatever was decided before.`, reason: "Nothing restricts the choices" },
            { statement: md`The number of decision lists is $2 \cdot 2 \cdots 2 = 2^n$.`, reason: md`Multiplication principle, $n$ stages` },
            { statement: md`$S$ has $2^n$ subsets.`, reason: "Step 1: subsets and decision lists pair off exactly, one list for each subset" },
          ],
        },
        {
          kind: "text",
          body: md`Check it on $\{a, b, c\}$: the subsets are $\varnothing$, $\{a\}$, $\{b\}$, $\{c\}$, $\{a, b\}$, $\{a, c\}$, $\{b, c\}$, $\{a, b, c\}$. That is $8 = 2^3$.`,
        },
        {
          kind: "check",
          prompt: md`In how many ways can 5 people stand in a line?`,
          answer: "120",
          explain: md`5 options for the first spot, then 4, 3, 2, 1: $5! = 120$.`,
        },
        {
          kind: "check",
          prompt: md`How many 3-letter strings (A to Z, repeats allowed) contain at least one A?`,
          answer: "1951",
          explain: md`All strings: $26^3 = 17{,}576$. Strings with no A: $25^3 = 15{,}625$. The difference is $1951$.`,
        },
      ],
      practice: [multiplicationPrinciple, factorials, casesAndComplements],
    },
    {
      id: "permutations-and-combinations",
      title: "Permutations and combinations",
      summary: "Choosing r things from n when order matters, P(n, r), and when it doesn't, C(n, r), and why the second is the first divided by r!.",
      blocks: [
        {
          kind: "text",
          body: md`A club of 10 people does two things. First it elects a president, a vice president and a treasurer. Then it picks a three-person cleanup crew, where everyone does the same job.

Both pick 3 people from 10. But the answers are different. If Ana is president and Ben is treasurer, swapping them gives a different set of officers. Swapping two people on the cleanup crew gives the same crew. In the first case **order matters**; in the second it doesn't.`,
        },
        {
          kind: "key",
          title: "Permutations",
          body: md`A **permutation** of $r$ objects from $n$ is an ordered list of $r$ different objects chosen from $n$. The number of them is

$$P(n, r) = n(n - 1)(n - 2) \cdots (n - r + 1) = \frac{n!}{(n - r)!}.$$

You may also see it written $_nP_r$.`,
        },
        {
          kind: "why",
          title: "Where the formula comes from",
          body: md`Fill $r$ positions in order. The first has $n$ options, the second $n - 1$, and the $r$th has $n - r + 1$. That's $r$ factors, multiplied by the multiplication principle.

The product is the start of $n!$ with the tail cut off. Multiply and divide by the missing tail, $(n - r)!$:

$$n(n - 1) \cdots (n - r + 1) = \frac{n(n - 1) \cdots (n - r + 1) \cdot (n - r)!}{(n - r)!} = \frac{n!}{(n - r)!}.$$

Check the extreme case $r = n$: $P(n, n) = \frac{n!}{0!} = n!$, all the arrangements of $n$ objects. That's one more reason $0! = 1$ is the right choice.`,
        },
        {
          kind: "example",
          title: "Officers",
          problem: md`In how many ways can a club of 10 choose a president, a vice president and a treasurer?`,
          steps: [
            { math: md`P(10, 3) = 10 \cdot 9 \cdot 8`, note: "Three different roles: order matters." },
            { math: md`720`, note: "" },
          ],
        },
        {
          kind: "text",
          body: md`Now the cleanup crew. Start from the 720 ordered lists and ask how many of them describe the **same** crew. The crew $\{A, B, C\}$ shows up as every ordering of those three people:

$$\begin{array}{cccccc} ABC & ACB & BAC & BCA & CAB & CBA \end{array}$$

That's $3! = 6$ lists for one crew. The same is true of every crew, so the 720 lists come in groups of 6, and there are $720 \div 6 = 120$ crews.`,
        },
        {
          kind: "key",
          title: "Combinations",
          body: md`A **combination** of $r$ objects from $n$ is a group of $r$ different objects, with no order. The number of them is written $\binom{n}{r}$, read "$n$ choose $r$" (also $C(n, r)$ or $_nC_r$):

$$\binom{n}{r} = \frac{P(n, r)}{r!} = \frac{n!}{r!\,(n - r)!}.$$`,
        },
        {
          kind: "proof",
          title: "The combination formula",
          given: md`$n$ different objects and a whole number $r$ with $0 \le r \le n$.`,
          prove: md`$\binom{n}{r} = \dfrac{n!}{r!\,(n - r)!}$`,
          steps: [
            { statement: md`There are $P(n, r) = \frac{n!}{(n - r)!}$ ordered lists of $r$ of the objects.`, reason: "The permutation formula" },
            { statement: md`Every ordered list can be made in exactly one way by first choosing a group of $r$, then putting the group in order.`, reason: "A list is its group of objects plus an order" },
            { statement: md`There are $\binom{n}{r}$ groups, and each can be ordered in $r!$ ways.`, reason: md`Definition of $\binom{n}{r}$; arrangements of $r$ objects (Lesson 1)` },
            { statement: md`$P(n, r) = \binom{n}{r} \cdot r!$`, reason: "Multiplication principle: both sides count the same lists" },
            { statement: md`$\binom{n}{r} = \dfrac{n!}{r!\,(n - r)!}$`, reason: md`Divide by $r!$, which is not 0, and use step 1` },
          ],
        },
        {
          kind: "why",
          title: "Why choosing r is the same as choosing n − r",
          body: md`Choosing the 3 people who go on the crew is the same act as choosing the 7 who stay behind. Each crew matches exactly one group of leftovers. So

$$\binom{n}{r} = \binom{n}{n - r}.$$

The formula agrees: swapping $r$ and $n - r$ just swaps the two factorials in the bottom. This saves work. $\binom{20}{18}$ is $\binom{20}{2} = \frac{20 \cdot 19}{2} = 190$.`,
        },
        {
          kind: "example",
          title: "Cancel before you multiply",
          problem: md`Evaluate $\binom{12}{4}$.`,
          steps: [
            { math: md`\frac{12!}{4!\,8!} = \frac{12 \cdot 11 \cdot 10 \cdot 9}{4!}`, note: md`Cancel the $8!$. What's left on top is $P(12, 4)$.` },
            { math: md`\frac{11{,}880}{24} = 495`, note: md`Dividing by $4! = 24$ removes the orderings.` },
          ],
        },
        {
          kind: "text",
          body: md`**Permutation or combination?** Take one possible outcome and swap two of the chosen items. If that gives a different outcome (different roles, places, positions), order matters: permutation. If it gives the same outcome (the same group, hand, or set), order doesn't matter: combination.

Many problems mix the two with the multiplication principle. A team with 2 of 6 juniors and 3 of 5 seniors can be picked in $\binom{6}{2}\binom{5}{3} = 15 \cdot 10 = 150$ ways: choose the juniors, then the seniors.`,
        },
        {
          kind: "example",
          title: "Repeated letters: the same divide-out idea",
          problem: md`How many different arrangements do the letters of BANANA have?`,
          steps: [
            { math: md`6! = 720`, note: "If all six letters were different (color the A's and N's)." },
            { math: md`3! \cdot 2! = 12`, note: "Each visible word appears once for every way to shuffle the three A's among themselves (3!) and the two N's (2!)." },
            { math: md`\frac{720}{12} = 60`, note: "Divide out the overcount, just as for combinations." },
          ],
        },
        {
          kind: "check",
          prompt: md`An ice cream shop has 8 flavors. How many different cups of 3 different flavors can you order?`,
          answer: "56",
          explain: md`A cup is a group of flavors, so order doesn't matter: $\binom{8}{3} = \frac{8 \cdot 7 \cdot 6}{3!} = \frac{336}{6} = 56$.`,
        },
        {
          kind: "check",
          prompt: md`Is this a permutation or a combination? A coach chooses a batting order for 9 of the 15 players on a team.`,
          choices: [PERM, COMB],
          accept: [PERM],
          explain: md`A batting order is a list: swapping the first and second batters gives a different order. It's $P(15, 9)$.`,
        },
      ],
      practice: [evaluateCounts, countingWordProblems, permutationOrCombination],
    },
    {
      id: "the-binomial-theorem",
      title: "The binomial theorem",
      summary: "Expanding (a + b)ⁿ without multiplying it out: the coefficients are counts of choices, and they form Pascal's triangle.",
      blocks: [
        {
          kind: "text",
          body: md`Squaring a binomial is familiar from Algebra 1: $(a + b)^2 = a^2 + 2ab + b^2$. Multiply once more:

$$(a + b)^3 = a^3 + 3a^2b + 3ab^2 + b^3.$$

For $(a + b)^{10}$, multiplying out by hand would take a long time. This lesson finds every coefficient directly, and the reason is counting.`,
        },
        {
          kind: "why",
          title: "Why the coefficients count choices",
          body: md`Write $(a + b)^3 = (a + b)(a + b)(a + b)$. When you distribute, each term of the result comes from picking **one letter from each factor** and multiplying. Write down which letter you picked from factor 1, 2 and 3:

$$aaa, \; aab, \; aba, \; baa, \; abb, \; bab, \; bba, \; bbb.$$

That's $2^3 = 8$ products. The ones equal to $a^2b$ are those with exactly one $b$: $aab, aba, baa$. There are 3 because you are choosing which **one** of the 3 factors supplies the $b$, and that can be done in $\binom{3}{1} = 3$ ways. So the coefficient of $a^2b$ is $\binom{3}{1}$.

The same reasoning works for every term and every power.`,
        },
        {
          kind: "key",
          title: "The binomial theorem",
          body: md`For any whole number $n$,

$$(a + b)^n = \sum_{k=0}^{n} \binom{n}{k} a^{n-k} b^k = a^n + \binom{n}{1}a^{n-1}b + \binom{n}{2}a^{n-2}b^2 + \dots + b^n.$$

The power of $a$ counts down from $n$, the power of $b$ counts up from 0, and in each term the powers add to $n$. The numbers $\binom{n}{k}$ are called **binomial coefficients**.`,
        },
        {
          kind: "proof",
          title: "The binomial theorem",
          given: md`$(a + b)^n$, a product of $n$ factors $(a + b)$.`,
          prove: md`The coefficient of $a^{n-k}b^k$ is $\binom{n}{k}$.`,
          steps: [
            { statement: md`Expanding gives one product for each way of picking $a$ or $b$ from every factor.`, reason: "The distributive property, used repeatedly" },
            { statement: md`A product equals $a^{n-k}b^k$ exactly when $b$ was picked from $k$ factors and $a$ from the other $n - k$.`, reason: "Multiplying the picked letters" },
            { statement: md`The pick is fixed once you say **which** $k$ factors give $b$.`, reason: "The others must give a" },
            { statement: md`There are $\binom{n}{k}$ ways to choose those $k$ factors.`, reason: "Definition of a combination" },
            { statement: md`Collecting like terms, $a^{n-k}b^k$ appears with coefficient $\binom{n}{k}$.`, reason: "Combining like terms adds up the matching products" },
          ],
        },
        {
          kind: "text",
          body: md`Write the binomial coefficients in rows, row $n$ holding $\binom{n}{0}, \binom{n}{1}, \dots, \binom{n}{n}$. This is **Pascal's triangle**:

$$${pascalTex(6)}$$

Each row starts and ends with 1, it reads the same backwards (that's $\binom{n}{k} = \binom{n}{n-k}$), and every inside entry is the sum of the two above it. For instance $10 = 4 + 6$ in row 5.`,
        },
        {
          kind: "proof",
          title: "Pascal's rule",
          given: md`Whole numbers $n \ge 1$ and $1 \le k \le n - 1$.`,
          prove: md`$\binom{n}{k} = \binom{n - 1}{k - 1} + \binom{n - 1}{k}$`,
          steps: [
            { statement: md`$\binom{n}{k}$ counts the groups of $k$ chosen from $n$ people. Single out one person, Ann.`, reason: "Definition of a combination" },
            { statement: md`Groups that include Ann: choose the other $k - 1$ members from the remaining $n - 1$ people, in $\binom{n - 1}{k - 1}$ ways.`, reason: "Ann's place is already taken" },
            { statement: md`Groups without Ann: choose all $k$ members from the other $n - 1$, in $\binom{n - 1}{k}$ ways.`, reason: "Definition of a combination" },
            { statement: md`$\binom{n}{k} = \binom{n - 1}{k - 1} + \binom{n - 1}{k}$`, reason: "Addition principle: every group either includes Ann or doesn't, never both" },
          ],
        },
        {
          kind: "example",
          title: "Expanding with a number",
          problem: md`Expand $(x + 2)^4$.`,
          steps: [
            { math: md`1,\; 4,\; 6,\; 4,\; 1`, note: "Row 4 of Pascal's triangle." },
            { math: md`x^4 + 4x^3(2) + 6x^2(2)^2 + 4x(2)^3 + (2)^4`, note: md`$a = x$ and $b = 2$. Powers of $x$ go down, powers of 2 go up.` },
            { math: md`x^4 + 8x^3 + 24x^2 + 32x + 16`, note: "" },
          ],
        },
        {
          kind: "example",
          title: "A negative term",
          problem: md`Expand $(2x - 1)^3$.`,
          steps: [
            { math: md`(2x)^3 + 3(2x)^2(-1) + 3(2x)(-1)^2 + (-1)^3`, note: md`Use $a = 2x$ and $b = -1$. Keep the parentheses: the 2 is raised to each power too.` },
            { math: md`8x^3 - 12x^2 + 6x - 1`, note: "Odd powers of -1 are negative, so the signs alternate." },
          ],
        },
        {
          kind: "example",
          title: "One term only",
          problem: md`Find the coefficient of $x^5$ in $(x + 3)^8$.`,
          steps: [
            { math: md`\binom{8}{5}x^5 \cdot 3^3`, note: md`$x^5$ means $x$ from 5 of the 8 factors and 3 from the other 3.` },
            { math: md`56 \cdot 27 = 1512`, note: md`$\binom{8}{5} = \binom{8}{3} = \frac{8 \cdot 7 \cdot 6}{6} = 56$.` },
          ],
        },
        {
          kind: "why",
          title: "Why each row of Pascal's triangle adds to 2ⁿ",
          body: md`Put $a = b = 1$ in the binomial theorem. Every power of 1 is 1, so

$$2^n = (1 + 1)^n = \binom{n}{0} + \binom{n}{1} + \dots + \binom{n}{n}.$$

This matches Lesson 1. The right side counts the subsets of an $n$-element set by size: those with 0 elements, with 1, and so on. The left side is the total number of subsets, $2^n$. Row 4: $1 + 4 + 6 + 4 + 1 = 16$.

The same trick, setting $x = 1$, gives the sum of the coefficients of any expansion: for $(2x - 1)^3$ it's $(2 - 1)^3 = 1$, and indeed $8 - 12 + 6 - 1 = 1$.`,
        },
        {
          kind: "check",
          prompt: md`Expand $(x + 1)^5$.`,
          answer: "x^5 + 5x^4 + 10x^3 + 10x^2 + 5x + 1",
          expanded: true,
          simplified: true,
          explain: md`Row 5 is $1, 5, 10, 10, 5, 1$, and every power of 1 is 1.`,
        },
        {
          kind: "check",
          prompt: md`Find the coefficient of $x^2$ in the expansion of $(x - 2)^5$.`,
          answer: "-80",
          explain: md`$x^2$ comes from $x$ in 2 factors and $-2$ in the other 3: $\binom{5}{2}(-2)^3 = 10 \cdot (-8) = -80$.`,
        },
      ],
      practice: [expandBinomial, binomialCoefficient, pascalAndSums],
    },
    {
      id: "probability-basics",
      title: "Probability basics",
      summary: "Probability as counting: sample spaces of equally likely outcomes, the complement and addition rules, independence, and conditional probability.",
      blocks: [
        {
          kind: "text",
          body: md`Roll a fair die. There are six possible results, and none is favored over another. It seems reasonable to say that rolling an even number has probability $\frac{3}{6}$: three of the six outcomes are even. That instinct is the whole definition, once the words are made precise.`,
        },
        {
          kind: "key",
          title: "Outcomes, events and probability",
          body: md`- An **experiment** has a set of possible **outcomes**, the **sample space** $S$.
- An **event** $E$ is a set of outcomes, a subset of $S$.
- When all outcomes are **equally likely**, the probability of $E$ is
$$P(E) = \frac{|E|}{|S|} = \frac{\text{number of outcomes in } E}{\text{number of outcomes in } S}.$$
- Here $|E|$ is a count of outcomes, not an absolute value. Always $0 \le P(E) \le 1$. $P(S) = 1$ (certain) and $P(\varnothing) = 0$ (impossible).`,
        },
        {
          kind: "why",
          title: "Why the outcomes must be equally likely",
          body: md`The definition counts outcomes, so each outcome must carry the same weight. That's a real requirement, not a formality.

Roll two dice and add. The possible sums are $2, 3, \dots, 12$, eleven of them. But $P(\text{sum } 7) = \frac{1}{11}$ is wrong, because the sums are not equally likely. The equally likely outcomes are the **ordered pairs** (red die, blue die): $6 \cdot 6 = 36$ of them by the multiplication principle. A sum of 2 happens only as $(1, 1)$. A sum of 7 happens six ways.

The meaning of $P(E)$: repeat the experiment many times, and $E$ happens in about that fraction of them.`,
        },
        { kind: "diagram", ...diceGrid },
        {
          kind: "key",
          title: "The complement rule",
          body: md`The event "not $E$" (the **complement** of $E$, written $E'$) holds the outcomes of $S$ that are not in $E$. Then

$$P(\text{not } E) = 1 - P(E).$$`,
        },
        {
          kind: "why",
          title: "Why the complement rule holds",
          body: md`Every outcome is in $E$ or in $E'$, and not both. By the addition principle, $|E| + |E'| = |S|$. Divide by $|S|$:

$$\frac{|E|}{|S|} + \frac{|E'|}{|S|} = 1, \quad\text{so}\quad P(E) + P(E') = 1.$$

It's Lesson 1's "count the opposite", divided by the total.`,
        },
        {
          kind: "example",
          title: "At least one six",
          problem: md`Two fair dice are rolled. What is the probability that at least one shows a 6?`,
          steps: [
            { math: md`P(\text{no } 6) = \frac{5 \cdot 5}{36} = \frac{25}{36}`, note: "No 6 means each die shows 1 to 5: 5 options each." },
            { math: md`P(\text{at least one } 6) = 1 - \frac{25}{36} = \frac{11}{36}`, note: "Complement rule. Check on the grid: row 6 and column 6 hold 6 + 6 - 1 = 11 dots." },
          ],
        },
        { kind: "diagram", ...vennDiagram },
        {
          kind: "proof",
          title: "The addition rule",
          given: md`Events $A$ and $B$ in a sample space $S$ of equally likely outcomes. "$A$ and $B$" (written $A \cap B$, the **intersection**) holds the outcomes in both; "$A$ or $B$" ($A \cup B$) holds those in at least one.`,
          prove: md`$P(A \text{ or } B) = P(A) + P(B) - P(A \text{ and } B)$`,
          steps: [
            { statement: md`$|A| + |B|$ counts every outcome of $A \cup B$ at least once.`, reason: "Each such outcome is in A, in B, or in both" },
            { statement: md`Outcomes in $A \cap B$ are counted twice; all others once.`, reason: "They appear in both lists" },
            { statement: md`$|A \cup B| = |A| + |B| - |A \cap B|$`, reason: "Subtract the double count once" },
            { statement: md`$P(A \cup B) = P(A) + P(B) - P(A \cap B)$`, reason: md`Divide by $|S|$: the definition of probability` },
          ],
        },
        {
          kind: "text",
          body: md`When $A$ and $B$ can't happen together (they're **mutually exclusive**), $A \cap B$ is empty and the rule becomes $P(A \text{ or } B) = P(A) + P(B)$. In the Venn diagram, a heart or a face card has probability $\frac{13}{52} + \frac{12}{52} - \frac{3}{52} = \frac{22}{52} = \frac{11}{26}$.`,
        },
        {
          kind: "key",
          title: "Independence and conditional probability",
          body: md`- $P(B \mid A)$, read "the probability of $B$ given $A$", is the probability of $B$ when you know $A$ happened. With equally likely outcomes,
$$P(B \mid A) = \frac{|A \cap B|}{|A|}.$$
- $A$ and $B$ are **independent** if knowing one happened doesn't change the probability of the other. Then
$$P(A \text{ and } B) = P(A) \cdot P(B).$$
- In general, $P(A \text{ and } B) = P(A) \cdot P(B \mid A)$.`,
        },
        {
          kind: "why",
          title: "Why conditional probability divides by |A|, and why independent events multiply",
          body: md`If you know $A$ happened, the outcomes outside $A$ are ruled out. $A$ becomes the new sample space, still equally likely, and the outcomes where $B$ also happens are $A \cap B$. So $P(B \mid A) = \frac{|A \cap B|}{|A|}$. Dividing top and bottom by $|S|$ gives $P(B \mid A) = \frac{P(A \text{ and } B)}{P(A)}$, which rearranges to the general product rule.

If $A$ and $B$ are independent, knowing $A$ happened doesn't change the chance of $B$: $P(B \mid A) = P(B)$. Then the general rule becomes $P(A \text{ and } B) = P(A) \cdot P(B)$.

For two separate experiments, like a coin and a die, you can see this directly. The multiplication principle says the combined sample space has $|S_1| \cdot |S_2|$ outcomes, and "$A$ on the first and $B$ on the second" has $|A| \cdot |B|$ of them. So

$$P(A \text{ and } B) = \frac{|A|\,|B|}{|S_1|\,|S_2|} = \frac{|A|}{|S_1|} \cdot \frac{|B|}{|S_2|} = P(A)\,P(B).$$

With more separate experiments, the same counting works stage by stage, so keep multiplying: three rolls with no 6 have probability $\frac{5}{6} \cdot \frac{5}{6} \cdot \frac{5}{6}$.`,
        },
        {
          kind: "example",
          title: "Without replacement",
          problem: md`A bag holds 5 red and 3 blue marbles. Two are drawn without putting the first back. What is the probability both are red?`,
          steps: [
            { math: md`P(\text{1st red}) = \frac{5}{8}`, note: "" },
            { math: md`P(\text{2nd red} \mid \text{1st red}) = \frac{4}{7}`, note: "One red marble is gone, and the bag has 7 left. The draws are not independent." },
            { math: md`\frac{5}{8} \cdot \frac{4}{7} = \frac{20}{56} = \frac{5}{14}`, note: "General product rule." },
            { math: md`\frac{\binom{5}{2}}{\binom{8}{2}} = \frac{10}{28} = \frac{5}{14}`, note: "Check by counting pairs: red pairs over all pairs. Same answer." },
          ],
        },
        {
          kind: "check",
          prompt: md`A fair die is rolled. What is the probability of a number greater than 4? Give a fraction in lowest terms.`,
          answer: "1/3",
          simplified: true,
          explain: md`The outcomes 5 and 6: $\frac{2}{6} = \frac{1}{3}$.`,
        },
        {
          kind: "check",
          prompt: md`Two fair dice are rolled. Given that the sum is 4, what is the probability that both dice show 2? Give a fraction in lowest terms.`,
          answer: "1/3",
          simplified: true,
          explain: md`Sum 4: $(1, 3), (2, 2), (3, 1)$, three equally likely outcomes. One of them is $(2, 2)$, so the answer is $\frac{1}{3}$.`,
        },
      ],
      practice: [basicProbability, complementAndAddition, independenceAndConditional],
    },
  ],
};
