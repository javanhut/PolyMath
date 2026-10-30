import { frac, fracTex, poly, type Rng } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(r: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** A sum formula that induction proves, with everything the generators need to talk about it. */
interface SumFamily {
  /** The claim in LaTeX, in n. */
  claim: string;
  /** The right side in LaTeX, in n. */
  formulaTex: string;
  /** The i-th term as a number and as LaTeX. */
  term: (i: number) => number;
  termTex: (i: number) => string;
  /** The right side as a number. */
  value: (n: number) => number;
  /** Inductive step: the k-sum formula plus the (k + 1)-th term, in LaTeX. */
  givenTex: string;
  /** What that simplifies to, as answer text and LaTeX: the formula with k + 1 in place of n. */
  key: string;
  keyTex: string;
  /** The simplification, one line at a time. */
  steps: Step[];
}

const FAMILIES: SumFamily[] = [
  {
    claim: md`1 + 2 + 3 + \cdots + n = \frac{n(n + 1)}{2}`,
    formulaTex: md`\frac{n(n + 1)}{2}`,
    term: (i) => i,
    termTex: (i) => String(i),
    value: (n) => (n * (n + 1)) / 2,
    givenTex: md`\frac{k(k + 1)}{2} + (k + 1)`,
    key: "(k+1)(k+2)/2",
    keyTex: md`\frac{(k + 1)(k + 2)}{2}`,
    steps: [
      { math: md`(k + 1)\left(\frac{k}{2} + 1\right)`, note: md`Both terms contain $k + 1$. Factor it out.` },
      { math: md`(k + 1) \cdot \frac{k + 2}{2}`, note: md`Inside the bracket, $\frac{k}{2} + 1 = \frac{k + 2}{2}$.` },
      { math: md`\frac{(k + 1)(k + 2)}{2}`, note: md`This is $\frac{n(n + 1)}{2}$ with $n = k + 1$: exactly what the claim predicts.` },
    ],
  },
  {
    claim: md`1 + 3 + 5 + \cdots + (2n - 1) = n^2`,
    formulaTex: md`n^2`,
    term: (i) => 2 * i - 1,
    termTex: (i) => String(2 * i - 1),
    value: (n) => n * n,
    givenTex: md`k^2 + (2k + 1)`,
    key: "(k+1)^2",
    keyTex: md`(k + 1)^2`,
    steps: [
      { math: md`k^2 + 2k + 1`, note: "Drop the parentheses." },
      { math: md`(k + 1)^2`, note: md`A perfect-square trinomial. This is $n^2$ with $n = k + 1$.` },
    ],
  },
  {
    claim: md`2 + 4 + 6 + \cdots + 2n = n(n + 1)`,
    formulaTex: md`n(n + 1)`,
    term: (i) => 2 * i,
    termTex: (i) => String(2 * i),
    value: (n) => n * (n + 1),
    givenTex: md`k(k + 1) + 2(k + 1)`,
    key: "(k+1)(k+2)",
    keyTex: md`(k + 1)(k + 2)`,
    steps: [{ math: md`(k + 1)(k + 2)`, note: md`Factor out the common $k + 1$; what is left is $k + 2$. This is $n(n + 1)$ with $n = k + 1$.` }],
  },
  {
    claim: md`1^2 + 2^2 + 3^2 + \cdots + n^2 = \frac{n(n + 1)(2n + 1)}{6}`,
    formulaTex: md`\frac{n(n + 1)(2n + 1)}{6}`,
    term: (i) => i * i,
    termTex: (i) => md`${i}^2`,
    value: (n) => (n * (n + 1) * (2 * n + 1)) / 6,
    givenTex: md`\frac{k(k + 1)(2k + 1)}{6} + (k + 1)^2`,
    key: "(k+1)(k+2)(2k+3)/6",
    keyTex: md`\frac{(k + 1)(k + 2)(2k + 3)}{6}`,
    steps: [
      { math: md`(k + 1)\left(\frac{k(2k + 1)}{6} + (k + 1)\right)`, note: md`Factor out the common $k + 1$.` },
      { math: md`(k + 1) \cdot \frac{2k^2 + k + 6k + 6}{6}`, note: md`Put the bracket over 6: $(k + 1) = \frac{6k + 6}{6}$.` },
      { math: md`(k + 1) \cdot \frac{2k^2 + 7k + 6}{6}`, note: "Collect like terms." },
      { math: md`\frac{(k + 1)(k + 2)(2k + 3)}{6}`, note: md`$2k^2 + 7k + 6 = (k + 2)(2k + 3)$. Compare with the formula at $n = k + 1$: $\frac{(k + 1)(k + 2)(2(k + 1) + 1)}{6}$. They match.` },
    ],
  },
  {
    claim: md`1 + 2 + 4 + \cdots + 2^{n - 1} = 2^n - 1`,
    formulaTex: md`2^n - 1`,
    term: (i) => 2 ** (i - 1),
    termTex: (i) => String(2 ** (i - 1)),
    value: (n) => 2 ** n - 1,
    givenTex: md`(2^k - 1) + 2^k`,
    key: "2^(k+1) - 1",
    keyTex: md`2^{k + 1} - 1`,
    steps: [
      { math: md`2 \cdot 2^k - 1`, note: md`$2^k + 2^k$ is two copies of $2^k$.` },
      { math: md`2^{k + 1} - 1`, note: md`$2 \cdot 2^k = 2^{k + 1}$. This is $2^n - 1$ with $n = k + 1$.` },
    ],
  },
  {
    claim: md`1 \cdot 2 + 2 \cdot 3 + \cdots + n(n + 1) = \frac{n(n + 1)(n + 2)}{3}`,
    formulaTex: md`\frac{n(n + 1)(n + 2)}{3}`,
    term: (i) => i * (i + 1),
    termTex: (i) => md`${i} \cdot ${i + 1}`,
    value: (n) => (n * (n + 1) * (n + 2)) / 3,
    givenTex: md`\frac{k(k + 1)(k + 2)}{3} + (k + 1)(k + 2)`,
    key: "(k+1)(k+2)(k+3)/3",
    keyTex: md`\frac{(k + 1)(k + 2)(k + 3)}{3}`,
    steps: [
      { math: md`(k + 1)(k + 2)\left(\frac{k}{3} + 1\right)`, note: md`Both terms contain $(k + 1)(k + 2)$. Factor it out.` },
      { math: md`\frac{(k + 1)(k + 2)(k + 3)}{3}`, note: md`$\frac{k}{3} + 1 = \frac{k + 3}{3}$. This is the formula with $n = k + 1$.` },
    ],
  },
  {
    claim: md`3 + 6 + 9 + \cdots + 3n = \frac{3n(n + 1)}{2}`,
    formulaTex: md`\frac{3n(n + 1)}{2}`,
    term: (i) => 3 * i,
    termTex: (i) => String(3 * i),
    value: (n) => (3 * n * (n + 1)) / 2,
    givenTex: md`\frac{3k(k + 1)}{2} + 3(k + 1)`,
    key: "3(k+1)(k+2)/2",
    keyTex: md`\frac{3(k + 1)(k + 2)}{2}`,
    steps: [
      { math: md`3(k + 1)\left(\frac{k}{2} + 1\right)`, note: md`Factor out the common $3(k + 1)$.` },
      { math: md`\frac{3(k + 1)(k + 2)}{2}`, note: md`$\frac{k}{2} + 1 = \frac{k + 2}{2}$. This is the formula with $n = k + 1$.` },
    ],
  },
  {
    claim: md`1 + 3 + 9 + \cdots + 3^{n - 1} = \frac{3^n - 1}{2}`,
    formulaTex: md`\frac{3^n - 1}{2}`,
    term: (i) => 3 ** (i - 1),
    termTex: (i) => String(3 ** (i - 1)),
    value: (n) => (3 ** n - 1) / 2,
    givenTex: md`\frac{3^k - 1}{2} + 3^k`,
    key: "(3^(k+1) - 1)/2",
    keyTex: md`\frac{3^{k + 1} - 1}{2}`,
    steps: [
      { math: md`\frac{3^k - 1 + 2 \cdot 3^k}{2}`, note: md`Write $3^k$ over 2: $3^k = \frac{2 \cdot 3^k}{2}$.` },
      { math: md`\frac{3 \cdot 3^k - 1}{2}`, note: md`$3^k + 2 \cdot 3^k = 3 \cdot 3^k$.` },
      { math: md`\frac{3^{k + 1} - 1}{2}`, note: md`$3 \cdot 3^k = 3^{k + 1}$. This is the formula with $n = k + 1$.` },
    ],
  },
];

/** The cubes formula: used for sums as numbers, but its k + 1 algebra is left to the lesson. */
const CUBES: Pick<SumFamily, "claim" | "formulaTex" | "term" | "termTex" | "value"> = {
  claim: md`1^3 + 2^3 + \cdots + n^3 = \left(\frac{n(n + 1)}{2}\right)^2`,
  formulaTex: md`\left(\frac{n(n + 1)}{2}\right)^2`,
  term: (i) => i ** 3,
  termTex: (i) => md`${i}^3`,
  value: (n) => ((n * (n + 1)) / 2) ** 2,
};

/** A claim P(n) written out at n, at a fixed k, at k + 1, and at its base case. */
interface Claim {
  n: string;
  k: string;
  k1: string;
  base: string;
  /** Where the induction starts. */
  n0: number;
}

const CLAIMS: Claim[] = [
  {
    n: md`$1 + 2 + \cdots + n = \frac{n(n + 1)}{2}$`,
    k: md`$1 + 2 + \cdots + k = \frac{k(k + 1)}{2}$`,
    k1: md`$1 + 2 + \cdots + (k + 1) = \frac{(k + 1)(k + 2)}{2}$`,
    base: md`$1 = \frac{1 \cdot 2}{2}$`,
    n0: 1,
  },
  {
    n: md`$1 + 3 + \cdots + (2n - 1) = n^2$`,
    k: md`$1 + 3 + \cdots + (2k - 1) = k^2$`,
    k1: md`$1 + 3 + \cdots + (2k + 1) = (k + 1)^2$`,
    base: md`$1 = 1^2$`,
    n0: 1,
  },
  {
    n: md`$1 + 2 + 4 + \cdots + 2^{n - 1} = 2^n - 1$`,
    k: md`$1 + 2 + 4 + \cdots + 2^{k - 1} = 2^k - 1$`,
    k1: md`$1 + 2 + 4 + \cdots + 2^k = 2^{k + 1} - 1$`,
    base: md`$1 = 2^1 - 1$`,
    n0: 1,
  },
  {
    n: md`$4^n - 1$ is divisible by 3`,
    k: md`$4^k - 1$ is divisible by 3`,
    k1: md`$4^{k + 1} - 1$ is divisible by 3`,
    base: md`$4^1 - 1$ is divisible by 3`,
    n0: 1,
  },
  {
    n: md`$5^n - 1$ is divisible by 4`,
    k: md`$5^k - 1$ is divisible by 4`,
    k1: md`$5^{k + 1} - 1$ is divisible by 4`,
    base: md`$5^1 - 1$ is divisible by 4`,
    n0: 1,
  },
  {
    n: md`$n^3 - n$ is divisible by 6`,
    k: md`$k^3 - k$ is divisible by 6`,
    k1: md`$(k + 1)^3 - (k + 1)$ is divisible by 6`,
    base: md`$1^3 - 1$ is divisible by 6`,
    n0: 1,
  },
  {
    n: md`$n^2 + n$ is even`,
    k: md`$k^2 + k$ is even`,
    k1: md`$(k + 1)^2 + (k + 1)$ is even`,
    base: md`$1^2 + 1$ is even`,
    n0: 1,
  },
  {
    n: md`$2^n > n$`,
    k: md`$2^k > k$`,
    k1: md`$2^{k + 1} > k + 1$`,
    base: md`$2^1 > 1$`,
    n0: 1,
  },
  {
    n: md`$n! > 2^n$`,
    k: md`$k! > 2^k$`,
    k1: md`$(k + 1)! > 2^{k + 1}$`,
    base: md`$4! > 2^4$`,
    n0: 4,
  },
  {
    n: md`$3^n > 2n + 1$`,
    k: md`$3^k > 2k + 1$`,
    k1: md`$3^{k + 1} > 2(k + 1) + 1$`,
    base: md`$3^2 > 2 \cdot 2 + 1$`,
    n0: 2,
  },
  {
    n: md`$(1 + x)^n \ge 1 + nx$ for every $x > -1$`,
    k: md`$(1 + x)^k \ge 1 + kx$ for every $x > -1$`,
    k1: md`$(1 + x)^{k + 1} \ge 1 + (k + 1)x$ for every $x > -1$`,
    base: md`$(1 + x)^1 \ge 1 + 1 \cdot x$ for every $x > -1$`,
    n0: 1,
  },
];

// ── Lesson 1 practice ───────────────────────────────────────────────────────

/** Check a claim at a small n: add the terms, or evaluate the formula. Sums as numbers. */
const checkSmallCases: Generator = (r) => {
  const kind = r.int(0, 2);
  const fam = r.next() < 0.15 ? CUBES : r.pick(FAMILIES);
  if (kind === 0) {
    const N = r.int(3, 6);
    const terms = Array.from({ length: N }, (_, i) => fam.term(i + 1));
    const total = terms.reduce((s, v) => s + v, 0);
    const lhs = Array.from({ length: N }, (_, i) => fam.termTex(i + 1)).join(" + ");
    return {
      prompt: md`Compute $${lhs}$, the left side of the claim $${fam.claim}$ at $n = ${N}$. Then check that the right side gives the same number.`,
      answer: String(total),
      hint: md`Add the ${N} terms. The right side at $n = ${N}$ is $${fam.formulaTex.replace(/n/g, String(N))}$; it should match.`,
      solution: [
        { math: md`${terms.join(" + ")} = ${total}`, note: "Work out each term, then add." },
        { math: md`${fam.formulaTex.replace(/n/g, String(N))} = ${fam.value(N)}`, note: md`The right side at $n = ${N}$. ${fam.value(N) === total ? "Same number, so the claim holds at this $n$." : ""}` },
        { math: String(total), note: md`A matching case is evidence, not a proof. Induction is what covers every $n$.` },
      ],
    };
  }
  if (kind === 1) {
    const N = r.int(2, 8);
    return {
      prompt: md`Find the value of $${fam.formulaTex}$ when $n = ${N}$. It is the right side of the claim $${fam.claim}$, so it should equal the sum of the first ${N} terms.`,
      answer: String(fam.value(N)),
      hint: md`Substitute $n = ${N}$ and work out the arithmetic.`,
      solution: [
        { math: md`${fam.formulaTex.replace(/n/g, `(${N})`)}`, note: md`Replace every $n$ with ${N}.` },
        { math: String(fam.value(N)), note: md`Compare with the sum: $${Array.from({ length: Math.min(N, 5) }, (_, i) => fam.termTex(i + 1)).join(" + ")}${N > 5 ? " + \\cdots" : ""} = ${fam.value(N)}$.` },
      ],
    };
  }
  const [b, N] = [r.pick([4, 5, 6, 7, 9, 10]), r.int(2, 4)];
  const value = b ** N - 1;
  return {
    prompt: md`Evaluate $${b}^n - 1$ when $n = ${N}$. The claim is that $${b}^n - 1$ is always divisible by ${b - 1}; check that this value is.`,
    answer: String(value),
    hint: md`$${b}^${N}$ is ${b} multiplied by itself ${N} times.`,
    solution: [
      { math: md`${b}^${N} - 1 = ${b ** N} - 1`, note: "Power first." },
      { math: String(value), note: md`And $${value} = ${b - 1} \cdot ${value / (b - 1)}$, a multiple of ${b - 1}, as the claim says.` },
    ],
  };
};

/** Name the parts of an induction proof: hypothesis, goal of the step, base case. */
const nameTheParts: Generator = (r) => {
  const c = r.pick(CLAIMS);
  const kind = r.int(0, 2);
  const hyp = md`${c.k}, for one particular $k \ge ${c.n0}$`;
  const goal = c.k1;
  const all = md`${c.n}, for every $n \ge ${c.n0}$`;
  const base = c.base;
  const choices = shuffle(r, [hyp, goal, all, base]);
  const setup = md`A proof by induction shows that ${c.n} for every integer $n \ge ${c.n0}$.`;
  if (kind === 0) {
    return {
      prompt: md`${setup} Which statement is the **inductive hypothesis**?`,
      choices,
      accept: [hyp],
      hint: "The hypothesis is the claim at a single, unspecified k. It is assumed, not proved.",
      solution: [
        { math: md`\text{Hypothesis: } P(k)`, note: md`In the inductive step we assume ${c.k} for one fixed $k \ge ${c.n0}$, and use it to reach the case $k + 1$.` },
        { math: md`\text{Not } P(k + 1)`, note: md`The statement "${c.k1}" is what the step must **prove**, not what it assumes.` },
        { math: md`\text{Not } P(n) \text{ for all } n`, note: "Assuming the claim for every n would be assuming the whole theorem." },
      ],
    };
  }
  if (kind === 1) {
    return {
      prompt: md`${setup} Using the hypothesis, which statement must the **inductive step** prove?`,
      choices,
      accept: [goal],
      hint: "The step moves from one case to the next: from k to k + 1.",
      solution: [
        { math: md`\text{Goal of the step: } P(k + 1)`, note: md`From ${c.k} we must deduce ${c.k1}.` },
        { math: md`P(k) \Rightarrow P(k + 1)`, note: "That implication, proved for an unspecified k, is what lets the base case spread to every n." },
      ],
    };
  }
  return {
    prompt: md`${setup} Which statement is the **base case**?`,
    choices,
    accept: [base],
    hint: md`The base case is the claim at the first value, $n = ${c.n0}$, checked directly.`,
    solution: [
      { math: md`P(${c.n0})`, note: md`Set $n = ${c.n0}$ in the claim: ${c.base}. This is checked by arithmetic, with no hypothesis.` },
      { math: md`\text{Base} + \text{step} \Rightarrow \text{all } n \ge ${c.n0}`, note: "The base case is the first domino. Without it the step has nothing to push." },
    ],
  };
};

/** The algebra of the inductive step: simplify the k + 1 expression, or find the constant that makes it work. */
const inductiveStepAlgebra: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind <= 1) {
    const fam = r.pick(FAMILIES);
    return {
      prompt: md`Simplify $${fam.givenTex}$. It is the left side of $${fam.claim}$ at $n = k + 1$, after the inductive hypothesis replaced the first $k$ terms. Write it as the formula predicts, in factored form like ${fam.key === "(k+1)^2" ? "(k+1)^2" : "(k+1)(k+2)/2"}.`,
      answer: fam.key,
      simplified: true,
      hint: md`The result should be $${fam.formulaTex}$ with $n = k + 1$. Look for a factor both terms share.`,
      solution: fam.steps,
    };
  }
  if (kind === 2) {
    const b = r.pick([4, 5, 6, 7, 8, 9, 10]);
    const d = b - 1;
    return {
      prompt: md`In the proof that $${b}^n - 1$ is divisible by ${d} for all $n \ge 1$, the inductive step rewrites $${b}^{k + 1} - 1$ as $${b}(${b}^k - 1) + c$ for a constant $c$. Find $c$.`,
      answer: String(d),
      // A constant c must make the identity hold at every k; three values of k pin it down.
      verify: [1, 2, 3].map((k) => `${b}^${k + 1} - 1 = ${b}(${b}^${k} - 1) + c`),
      hint: md`Expand $${b}(${b}^k - 1)$ and compare with $${b}^{k + 1} - 1 = ${b} \cdot ${b}^k - 1$.`,
      solution: [
        { math: md`${b}^{k + 1} - 1 = ${b} \cdot ${b}^k - 1`, note: md`Peel one factor of ${b} off the power so the hypothesis quantity $${b}^k - 1$ can appear.` },
        { math: md`${b} \cdot ${b}^k - 1 = ${b}(${b}^k - 1) + ${b} - 1`, note: md`$${b}(${b}^k - 1) = ${b} \cdot ${b}^k - ${b}$, which is ${b} too small; add ${b} back.` },
        { math: md`c = ${d}`, note: md`So $${b}^{k + 1} - 1 = ${b}(${b}^k - 1) + ${d}$. The first part is a multiple of ${d} by the hypothesis and the second is ${d} itself, so the sum is divisible by ${d}.` },
      ],
    };
  }
  const variant = r.int(0, 2);
  if (variant === 0) {
    return {
      prompt: md`In the proof that $n^2 + n$ is even for all $n \ge 1$, the inductive step writes $(k + 1)^2 + (k + 1) = (k^2 + k) + c(k + 1)$ for a constant $c$. Find $c$.`,
      answer: "2",
      verify: [1, 2, 3].map((k) => `(${k}+1)^2 + (${k}+1) = (${k}^2 + ${k}) + c(${k}+1)`),
      hint: md`Expand $(k + 1)^2 + (k + 1)$, then subtract $k^2 + k$ and see what is left.`,
      solution: [
        { math: md`(k + 1)^2 + (k + 1) = k^2 + 2k + 1 + k + 1 = k^2 + 3k + 2`, note: "Expand." },
        { math: md`k^2 + 3k + 2 - (k^2 + k) = 2k + 2 = 2(k + 1)`, note: "Subtract the hypothesis quantity." },
        { math: md`c = 2`, note: md`$k^2 + k$ is even by the hypothesis and $2(k + 1)$ is even, so their sum is even.` },
      ],
    };
  }
  if (variant === 1) {
    return {
      prompt: md`In the proof that $n^3 - n$ is divisible by 6 for all $n \ge 1$, the inductive step writes $(k + 1)^3 - (k + 1) = (k^3 - k) + q$, where $q$ is a polynomial in $k$. Find $q$. Type it like 3k^2 + 3k.`,
      answer: "3k^2 + 3k",
      verify: ["(k+1)^3 - (k+1) = (k^3 - k) + q"],
      hint: md`Expand $(k + 1)^3 = k^3 + 3k^2 + 3k + 1$, then subtract $k^3 - k$.`,
      solution: [
        { math: md`(k + 1)^3 - (k + 1) = k^3 + 3k^2 + 3k + 1 - k - 1 = k^3 + 3k^2 + 2k`, note: "Expand and collect." },
        { math: md`k^3 + 3k^2 + 2k - (k^3 - k) = 3k^2 + 3k`, note: "Subtract the hypothesis quantity." },
        { math: md`q = 3k^2 + 3k = 3k(k + 1)`, note: md`$k(k + 1)$ is a product of consecutive integers, so it is even, and $3k(k + 1)$ is a multiple of 6. With the hypothesis, the whole thing is divisible by 6.` },
      ],
    };
  }
  const pairs: [number, number][] = [[5, 2], [7, 4], [7, 2], [8, 5], [9, 4], [7, 3], [9, 2]];
  const [a, b] = r.pick(pairs);
  return {
    prompt: md`In the proof that $${a}^n - ${b}^n$ is divisible by ${a - b} for all $n \ge 1$, the inductive step writes $${a}^{k + 1} - ${b}^{k + 1} = ${a}(${a}^k - ${b}^k) + c \cdot ${b}^k$ for a constant $c$. Find $c$.`,
    answer: String(a - b),
    verify: [1, 2, 3].map((k) => `${a}^${k + 1} - ${b}^${k + 1} = ${a}(${a}^${k} - ${b}^${k}) + c ${b}^${k}`),
    hint: md`Expand $${a}(${a}^k - ${b}^k) = ${a}^{k + 1} - ${a} \cdot ${b}^k$. How much $${b}^k$ must be added to turn $-${a} \cdot ${b}^k$ into $-${b}^{k + 1} = -${b} \cdot ${b}^k$?`,
    solution: [
      { math: md`${a}(${a}^k - ${b}^k) = ${a}^{k + 1} - ${a} \cdot ${b}^k`, note: "Expand the hypothesis part." },
      { math: md`${a}^{k + 1} - ${b}^{k + 1} - (${a}^{k + 1} - ${a} \cdot ${b}^k) = ${a} \cdot ${b}^k - ${b} \cdot ${b}^k = ${a - b} \cdot ${b}^k`, note: md`$${b}^{k + 1} = ${b} \cdot ${b}^k$.` },
      { math: md`c = ${a - b}`, note: md`Both pieces are multiples of ${a - b}: the first by the hypothesis, the second visibly. So $${a}^{k + 1} - ${b}^{k + 1}$ is too.` },
    ],
  };
};

// ── Lesson 2 practice ───────────────────────────────────────────────────────

/** Limits of sequences by algebra: rational, geometric tails, conjugates. */
const sequenceLimit: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const a = r.nonzero(-6, 6);
    const c = r.int(1, 5);
    const b = r.nonzero(-9, 9);
    const d = r.int(1, 9);
    const top = poly([[a, "n"], [b, ""]]);
    const bot = poly([[c, "n"], [d, ""]]);
    return {
      prompt: md`Find $\lim_{n \to \infty} \frac{${top}}{${bot}}$. Fractions are fine, like 3/4.`,
      answer: frac(a, c),
      hint: md`Divide every term, top and bottom, by $n$. Then ask what $\frac{1}{n}$ does as $n$ grows.`,
      solution: [
        { math: md`\frac{${top}}{${bot}} = \frac{${a} ${b < 0 ? "-" : "+"} ${Math.abs(b)}/n}{${c} ${d < 0 ? "-" : "+"} ${Math.abs(d)}/n}`, note: md`Divide top and bottom by $n$, the highest power present.` },
        { math: md`\frac{${b}}{n} \to 0 \quad\text{and}\quad \frac{${d}}{n} \to 0`, note: md`A fixed number over $n$ shrinks to 0: past $n = N$ it is smaller than any distance you name.` },
        { math: md`\lim_{n \to \infty} a_n = \frac{${a}}{${c}}${frac(a, c) !== `${a}/${c}` ? ` = ${fracTex(a, c)}` : ""}`, note: "The ratio of the leading coefficients." },
      ],
    };
  }
  if (kind === 1) {
    const a = r.nonzero(-6, 6);
    const d = r.int(1, 5);
    const b = r.int(-6, 6);
    const c = r.int(-9, 9);
    const e = r.int(0, 6);
    const f = r.int(1, 9);
    const top = poly([[a, "n^2"], [b, "n"], [c, ""]]);
    const bot = poly([[d, "n^2"], [e, "n"], [f, ""]]);
    return {
      prompt: md`Find $\lim_{n \to \infty} \frac{${top}}{${bot}}$. Fractions are fine, like 3/4.`,
      answer: frac(a, d),
      hint: md`Divide every term by $n^2$. Every $\frac{\text{number}}{n}$ and $\frac{\text{number}}{n^2}$ goes to 0.`,
      solution: [
        { math: md`\frac{${top}}{${bot}} = \frac{${poly([[a, ""], [b, "/n"], [c, "/n^2"]])}}{${poly([[d, ""], [e, "/n"], [f, "/n^2"]])}}`, note: md`Divide top and bottom by $n^2$.` },
        { math: md`\to \frac{${a}}{${d}}${frac(a, d) !== `${a}/${d}` ? ` = ${fracTex(a, d)}` : ""}`, note: md`Each term with an $n$ underneath goes to 0, leaving only the leading coefficients.` },
      ],
    };
  }
  if (kind === 2) {
    const a = r.nonzero(-6, 6);
    const b = r.int(-9, 9);
    const c = r.int(1, 4);
    const d = r.int(1, 9);
    const top = poly([[a, "n"], [b, ""]]);
    const bot = poly([[c, "n^2"], [d, ""]]);
    return {
      prompt: md`Find $\lim_{n \to \infty} \frac{${top}}{${bot}}$.`,
      answer: "0",
      hint: md`Divide every term by $n^2$, the highest power in the fraction.`,
      solution: [
        { math: md`\frac{${top}}{${bot}} = \frac{${poly([[a, "/n"], [b, "/n^2"]])}}{${poly([[c, ""], [d, "/n^2"]])}}`, note: md`Divide top and bottom by $n^2$.` },
        { math: md`\to \frac{0}{${c}} = 0`, note: md`Every term on top has an $n$ underneath and goes to 0; the bottom goes to ${c}. The denominator grows faster, so the fraction dies out.` },
      ],
    };
  }
  if (kind === 3) {
    const L = r.int(-5, 9);
    const c = r.nonzero(-6, 6);
    const [p, q] = r.pick([[1, 2], [1, 3], [2, 3], [3, 4], [1, 4], [3, 5], [4, 5]]);
    const coef = Math.abs(c) === 1 ? "" : String(Math.abs(c));
    const expr = md`${L} ${c < 0 ? "-" : "+"} ${coef}\left(\frac{${p}}{${q}}\right)^n`;
    return {
      prompt: md`Find $\lim_{n \to \infty} \left(${expr}\right)$.`,
      answer: String(L),
      hint: md`What happens to $\left(\frac{${p}}{${q}}\right)^n$ when you keep multiplying by a number smaller than 1?`,
      solution: [
        { math: md`\left(\frac{${p}}{${q}}\right)^n \to 0`, note: md`Each term is $\frac{${p}}{${q}}$ of the one before, so the powers shrink toward 0 (the theorem $r^n \to 0$ for $|r| < 1$).` },
        { math: md`${c < 0 ? "-" : ""}${coef}\left(\frac{${p}}{${q}}\right)^n \to 0`, note: "A fixed multiple of something going to 0 goes to 0." },
        { math: md`\lim_{n \to \infty} a_n = ${L}`, note: md`The constant ${L} is all that remains.` },
      ],
    };
  }
  const a = r.int(1, 9);
  return {
    prompt: md`Find $\lim_{n \to \infty} \left(\sqrt{n^2 + ${a}n} - n\right)$. Fractions are fine, like 3/2.`,
    answer: frac(a, 2),
    hint: md`Multiply by $\frac{\sqrt{n^2 + ${a}n} + n}{\sqrt{n^2 + ${a}n} + n}$. The top becomes a difference of squares.`,
    solution: [
      { math: md`\sqrt{n^2 + ${a}n} - n = \frac{(n^2 + ${a}n) - n^2}{\sqrt{n^2 + ${a}n} + n} = \frac{${a}n}{\sqrt{n^2 + ${a}n} + n}`, note: md`Multiply top and bottom by the conjugate $\sqrt{n^2 + ${a}n} + n$; $(\sqrt{u} - n)(\sqrt{u} + n) = u - n^2$.` },
      { math: md`= \frac{${a}}{\sqrt{1 + ${a}/n} + 1}`, note: md`Divide top and bottom by $n$; inside the root, $n = \sqrt{n^2}$, so $\frac{\sqrt{n^2 + ${a}n}}{n} = \sqrt{1 + \frac{${a}}{n}}$.` },
      { math: md`\to \frac{${a}}{\sqrt{1} + 1} = ${fracTex(a, 2)}`, note: md`$\frac{${a}}{n} \to 0$, so the root goes to 1.` },
    ],
  };
};

const BEHAVIOR = ["converges to 0", "converges to a nonzero number", "grows without bound", "oscillates with no limit"] as const;
type Behavior = (typeof BEHAVIOR)[number];

/** Converge or diverge, and how. */
const describeBehavior: Generator = (r) => {
  const L = r.int(2, 9);
  const c = r.int(2, 9);
  const [p, q] = r.pick([[1, 2], [1, 3], [2, 3], [3, 4], [2, 5]]);
  const items: { tex: string; right: Behavior; steps: Step[] }[] = [
    {
      tex: md`\frac{${c}}{n}`,
      right: "converges to 0",
      steps: [{ math: md`\frac{${c}}{n} \to 0`, note: md`Past $n = ${c} \cdot 1000$ every term is below $0.001$, and so on for any distance. The limit is 0.` }],
    },
    {
      tex: md`${L} - \frac{1}{n}`,
      right: "converges to a nonzero number",
      steps: [{ math: md`${L} - \frac{1}{n} \to ${L} - 0 = ${L}`, note: md`The $\frac{1}{n}$ fades; the terms creep up toward ${L} and stay as close as you like.` }],
    },
    {
      tex: md`(-1)^n`,
      right: "oscillates with no limit",
      steps: [{ math: md`-1, 1, -1, 1, \dots`, note: "The terms hop between two values a distance 2 apart forever. No single number has all the later terms within, say, 0.5 of it." }],
    },
    {
      tex: md`\sqrt{n}`,
      right: "grows without bound",
      steps: [{ math: md`\sqrt{n} > M \iff n > M^2`, note: md`Name any bound $M$; past $n = M^2$ the terms exceed it. The terms never settle near a number.` }],
    },
    {
      tex: md`\frac{(-1)^n}{n}`,
      right: "converges to 0",
      steps: [{ math: md`\left|\frac{(-1)^n}{n} - 0\right| = \frac{1}{n} \to 0`, note: "The signs alternate but the hops shrink. Every term is within 1/n of 0, and that distance goes to 0." }],
    },
    {
      tex: md`\frac{n^2 + 1}{${c}n + 1}`,
      right: "grows without bound",
      steps: [{ math: md`\frac{n^2 + 1}{${c}n + 1} = \frac{n + 1/n}{${c} + 1/n} \approx \frac{n}{${c}}`, note: md`Divide by $n$: the top still grows like $n$ while the bottom settles at ${c}. The terms pass every bound.` }],
    },
    {
      tex: md`\frac{${L}n + ${c}}{n + 1}`,
      right: "converges to a nonzero number",
      steps: [{ math: md`\frac{${L} + ${c}/n}{1 + 1/n} \to \frac{${L}}{1} = ${L}`, note: md`Equal degrees: the limit is the ratio of leading coefficients, ${L}.` }],
    },
    {
      tex: md`\left(\frac{${p}}{${q}}\right)^n`,
      right: "converges to 0",
      steps: [{ math: md`\left(\frac{${p}}{${q}}\right)^n \to 0`, note: md`Each term is $\frac{${p}}{${q}} < 1$ times the one before. By the theorem on $r^n$ with $|r| < 1$, the terms sink to 0.` }],
    },
    {
      tex: p === 1 ? md`${q}^n` : md`\left(\frac{${q}}{${p}}\right)^n`,
      right: "grows without bound",
      steps: [{ math: md`${p === 1 ? md`${q}^n` : md`\left(\frac{${q}}{${p}}\right)^n`} \ge 1 + n\left(${fracTex(q, p)} - 1\right) = 1 + ${fracTex(q - p, p)}n`, note: md`Bernoulli's inequality with $x = ${fracTex(q, p)} - 1 > 0$: the terms climb at least linearly, past any bound.` }],
    },
    {
      tex: md`\frac{n}{n^2 + 1}`,
      right: "converges to 0",
      steps: [{ math: md`\frac{n}{n^2 + 1} = \frac{1/n}{1 + 1/n^2} \to \frac{0}{1} = 0`, note: "The bottom has the higher degree, so the fraction dies out." }],
    },
    {
      tex: md`(-1)^n \frac{n}{n + 1}`,
      right: "oscillates with no limit",
      steps: [{ math: md`-\tfrac{1}{2}, \tfrac{2}{3}, -\tfrac{3}{4}, \tfrac{4}{5}, \dots`, note: md`$\frac{n}{n + 1} \to 1$, so even terms approach 1 and odd terms approach $-1$. The terms keep hopping a distance near 2: no limit.` }],
    },
    {
      tex: md`${L} + \left(\frac{${p}}{${q}}\right)^n`,
      right: "converges to a nonzero number",
      steps: [{ math: md`${L} + \left(\frac{${p}}{${q}}\right)^n \to ${L} + 0 = ${L}`, note: md`The geometric part sinks to 0, leaving ${L}.` }],
    },
    {
      tex: md`\left(1 + \frac{1}{n}\right)^n`,
      right: "converges to a nonzero number",
      steps: [{ math: md`\left(1 + \frac{1}{n}\right)^n \to e \approx 2.718`, note: "From Algebra 2 Unit 6: compounding more and more often approaches continuous compounding. The limit is e, not 0 and not infinite." }],
    },
    {
      tex: md`(-1)^n + \frac{1}{n}`,
      right: "oscillates with no limit",
      steps: [{ math: md`0, \tfrac{3}{2}, -\tfrac{2}{3}, \tfrac{5}{4}, \dots`, note: md`The $\frac{1}{n}$ fades, but the $(-1)^n$ keeps the terms hopping between near $-1$ and near 1.` }],
    },
    {
      tex: md`\sqrt{n + 1} - \sqrt{n}`,
      right: "converges to 0",
      steps: [{ math: md`\sqrt{n + 1} - \sqrt{n} = \frac{1}{\sqrt{n + 1} + \sqrt{n}} \to 0`, note: "Multiply by the conjugate: the top becomes 1 and the bottom grows without bound, so the fraction goes to 0." }],
    },
    {
      tex: md`\frac{n^2 - ${c}}{n}`,
      right: "grows without bound",
      steps: [{ math: md`\frac{n^2 - ${c}}{n} = n - \frac{${c}}{n}`, note: md`A growing $n$ minus a fading fraction. The terms pass every bound.` }],
    },
  ];
  const item = r.pick(items);
  return {
    prompt: md`Describe the behavior of $a_n = ${item.tex}$ as $n \to \infty$.`,
    choices: [...BEHAVIOR],
    accept: [item.right],
    hint: "Write out the first few terms, then think about which part of the formula is fading and which part is in charge for large n.",
    solution: item.steps,
  };
};

/** The informal epsilon: how far out must you go for the terms to be within d of the limit? */
const howFarOut: Generator = (r) => {
  const kind = r.int(0, 2);
  const D = r.pick([10, 20, 50, 100, 1000]);
  const dText = String(1 / D);
  if (kind === 0) {
    const L = r.int(1, 9);
    const c = r.pick([1, 2, 3, 5]);
    const n = c * D + 1;
    return {
      prompt: md`Let $a_n = \frac{${poly([[L, "n"], [c, ""]])}}{n}$, which converges to ${L}. Find the smallest $n$ for which $|a_n - ${L}| < ${dText}$.`,
      answer: String(n),
      hint: md`Simplify $a_n - ${L}$ first. It is a fraction with $n$ underneath.`,
      solution: [
        { math: md`a_n - ${L} = \frac{${poly([[L, "n"], [c, ""]])}}{n} - ${L} = \frac{${c}}{n}`, note: md`The distance from the limit is $\frac{${c}}{n}$, always positive.` },
        { math: md`\frac{${c}}{n} < ${dText} \iff n > ${c * D}`, note: md`Multiply both sides by $n$ and divide by ${dText}.` },
        { math: md`n = ${n}`, note: md`At $n = ${c * D}$ the distance is exactly ${dText}, not less. The first term strictly inside the band is $a_{${n}}$, and every term after it stays inside.` },
      ],
    };
  }
  if (kind === 1) {
    const c = r.pick([1, 2, 3, 4]);
    let n = 1;
    while (c * D >= n * n) n++;
    const root = Math.sqrt(c * D);
    const exact = Number.isInteger(root);
    return {
      prompt: md`Let $a_n = \frac{${c}}{n^2}$, which converges to 0. Find the smallest $n$ for which $a_n < ${dText}$.`,
      answer: String(n),
      hint: md`$\frac{${c}}{n^2} < ${dText}$ means $n^2 > ${c * D}$.`,
      solution: [
        { math: md`\frac{${c}}{n^2} < ${dText} \iff n^2 > ${c * D}`, note: md`Multiply both sides by $n^2$ and divide by ${dText}.` },
        { math: exact ? md`n > \sqrt{${c * D}} = ${root}` : md`n > \sqrt{${c * D}} \approx ${root.toFixed(2)}`, note: exact ? md`At $n = ${root}$ the two sides are equal, so $n$ must be larger.` : md`The first integer past $${root.toFixed(2)}$.` },
        { math: md`n = ${n}`, note: md`Check: $a_{${n}} = \frac{${c}}{${n * n}} \approx ${(c / (n * n)).toPrecision(3)} < ${dText}$, while $a_{${n - 1}} = \frac{${c}}{${(n - 1) ** 2}} \approx ${(c / (n - 1) ** 2).toPrecision(3)}$ is not.` },
      ],
    };
  }
  const [p, q] = r.pick([[1, 2], [1, 3], [2, 3], [3, 4]]);
  let n = 1;
  // (p/q)^n < 1/D  <=>  p^n D < q^n, in integers.
  while (p ** n * D >= q ** n) n++;
  return {
    prompt: md`Let $a_n = \left(\frac{${p}}{${q}}\right)^n$, which converges to 0. Find the smallest $n$ for which $a_n < ${dText}$.`,
    answer: String(n),
    hint: md`Keep multiplying by $\frac{${p}}{${q}}$ until the value drops below ${dText}. Or compare the powers: $${p === 1 ? "" : md`${p}^n \cdot `}${D} < ${q}^n$.`,
    solution: [
      { math: md`\left(\frac{${p}}{${q}}\right)^n < \frac{1}{${D}} \iff ${p === 1 ? "" : md`${p}^n \cdot `}${D} < ${q}^n`, note: "Clear the fractions so the comparison is between whole numbers." },
      { math: md`a_{${n - 1}} = \frac{${p ** (n - 1)}}{${q ** (n - 1)}} \approx ${((p / q) ** (n - 1)).toPrecision(3)}, \qquad a_{${n}} = \frac{${p ** n}}{${q ** n}} \approx ${((p / q) ** n).toPrecision(3)}`, note: md`The first is still at least ${dText}; the second is below it.` },
      { math: md`n = ${n}`, note: md`Since each term is $\frac{${p}}{${q}}$ of the one before, every later term is smaller still, so the whole tail stays inside.` },
    ],
  };
};

/** A few terms of a recursive sequence, rounded for display. */
function firstTerms(a1: number, next: (a: number) => number, count: number): string {
  const terms: number[] = [a1];
  for (let i = 1; i < count; i++) terms.push(next(terms[i - 1]!));
  return terms.map((t) => (Number.isInteger(t) ? String(t) : t.toFixed(4).replace(/0+$/, "").replace(/\.$/, ""))).join(",\\; ");
}

/** If a recursive sequence converges, its limit satisfies the recursion's fixed-point equation. */
const recursiveLimit: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const m = r.pick([2, 3, 4, 5]);
    const L = r.int(1, 9);
    const b = L * (m - 1);
    const a1 = r.pick([0, 1, 2 * L, 3 * L].filter((v) => v !== L));
    return {
      prompt: md`The sequence with $a_1 = ${a1}$ and $a_{n + 1} = \frac{a_n + ${b}}{${m}}$ converges. Find its limit.`,
      answer: String(L),
      verify: [`L = (L + ${b})/${m}`],
      hint: md`If $a_n \to L$, then $a_{n + 1} \to L$ too. Replace both with $L$ in the rule and solve.`,
      solution: [
        { math: md`${firstTerms(a1, (a) => (a + b) / m, 4)}, \dots`, note: "The first few terms, to see where they are heading." },
        { math: md`L = \frac{L + ${b}}{${m}}`, note: md`Both $a_{n + 1}$ and $a_n$ approach $L$, and limits respect arithmetic, so the rule passes to the limit.` },
        { math: md`${m}L = L + ${b} \;\Rightarrow\; ${m - 1}L = ${b} \;\Rightarrow\; L = ${L}`, note: "Solve the fixed-point equation." },
      ],
    };
  }
  if (kind === 1) {
    const c = r.pick([2, 3, 5, 6, 7, 10, 11, 13]);
    return {
      prompt: md`The sequence with $a_1 = ${c}$ and $a_{n + 1} = \frac{1}{2}\left(a_n + \frac{${c}}{a_n}\right)$ has positive terms and converges. Find its limit. Type it like sqrt(5).`,
      answer: `sqrt(${c})`,
      simplified: true,
      verify: [`2L = L + ${c}/L`],
      hint: md`Replace $a_{n + 1}$ and $a_n$ by $L$. Multiply through by $2L$ to clear the fraction.`,
      solution: [
        { math: md`${firstTerms(c, (a) => (a + c / a) / 2, 4)}, \dots`, note: "The terms settle quickly." },
        { math: md`L = \frac{1}{2}\left(L + \frac{${c}}{L}\right)`, note: md`If $a_n \to L$ then so does $a_{n + 1}$, and the rule passes to the limit (with $L \ne 0$, since the terms stay positive).` },
        { math: md`2L = L + \frac{${c}}{L} \;\Rightarrow\; L^2 = ${c}`, note: md`Multiply by $2L$, subtract $L$, multiply by $L$.` },
        { math: md`L = \sqrt{${c}}`, note: md`The terms are positive, so the negative root is ruled out. This is the ancient recipe for square roots: average $a$ and $\frac{${c}}{a}$.` },
      ],
    };
  }
  if (kind === 2) {
    const L = r.int(2, 6);
    const b = L * L - L;
    const a1 = r.pick([0, 1, b, 2 * L].filter((v) => v !== L));
    return {
      prompt: md`The sequence with $a_1 = ${a1}$ and $a_{n + 1} = \sqrt{a_n + ${b}}$ has positive terms and converges. Find its limit.`,
      answer: String(L),
      verify: [`L^2 = L + ${b}`],
      hint: md`Replace both terms by $L$, then square both sides and solve the quadratic. Keep the positive root.`,
      solution: [
        { math: md`${firstTerms(a1, (a) => Math.sqrt(a + b), 4)}, \dots`, note: "The first few terms." },
        { math: md`L = \sqrt{L + ${b}} \;\Rightarrow\; L^2 = L + ${b}`, note: "The rule passes to the limit; square both sides." },
        { math: md`L^2 - L - ${b} = 0 \;\Rightarrow\; (L - ${L})(L + ${L - 1}) = 0`, note: "Factor." },
        { math: md`L = ${L}`, note: md`$L = -${L - 1}$ is impossible for a limit of positive terms (and a square root is never negative).` },
      ],
    };
  }
  const m = r.pick([2, 3, 4]);
  const t = r.int(1, 5);
  const L = t * m;
  const d = t * (m - 1);
  const a1 = r.pick([0, 1, 2 * L].filter((v) => v !== L));
  return {
    prompt: md`The sequence with $a_1 = ${a1}$ and $a_{n + 1} = \frac{a_n}{${m}} + ${d}$ converges. Find its limit.`,
    answer: String(L),
    verify: [`L = L/${m} + ${d}`],
    hint: md`Replace $a_{n + 1}$ and $a_n$ by $L$ and solve the resulting linear equation.`,
    solution: [
      { math: md`${firstTerms(a1, (a) => a / m + d, 4)}, \dots`, note: "The first few terms." },
      { math: md`L = \frac{L}{${m}} + ${d}`, note: "The rule passes to the limit." },
      { math: md`${m}L = L + ${d * m} \;\Rightarrow\; ${m - 1}L = ${d * m} \;\Rightarrow\; L = ${L}`, note: md`Multiply by ${m} and solve. Each step, the gap between $a_n$ and ${L} is divided by ${m}, which is why the terms close in.` },
    ],
  };
};

// ── The unit ────────────────────────────────────────────────────────────────

const SQUARE_POINTS = Array.from({ length: 8 }, (_, i) => ({ x: i + 1, y: (i + 1) ** 2, label: i < 4 ? md`${i + 1}^2 = ${(i + 1) ** 2}` : undefined, color: 2 as const }));
const SEQ_POINTS = Array.from({ length: 20 }, (_, i) => ({ x: i + 1, y: (3 * (i + 1) + 1) / (i + 1), color: 1 as const }));
const GEOM_POINTS = Array.from({ length: 12 }, (_, i) => ({ x: i + 1, y: `r^${i + 1}`, color: 1 as const }));

export const unit7: Unit = {
  title: "Sequences, Series and Induction",
  lessons: [
    {
      id: slug("Mathematical induction"),
      title: "Mathematical induction",
      summary: "How to prove a statement about every positive integer at once: the base case, the inductive step, and why those two together are enough.",
      blocks: [
        {
          kind: "text",
          body: md`Some claims are about every positive integer at once. Here is one:

$$1 + 3 + 5 + \cdots + (2n - 1) = n^2.$$

The sum of the first $n$ odd numbers is $n^2$. Try it: $1 = 1^2$. $1 + 3 = 4 = 2^2$. $1 + 3 + 5 = 9 = 3^2$. $1 + 3 + 5 + 7 = 16 = 4^2$. Every case we check works.

But checking cases can never finish the job. However many we test, infinitely many $n$ remain, and a pattern that holds a thousand times can still fail at the thousand-and-first. What we need is a finite argument that reaches every $n$. That is what induction is.`,
        },
        {
          kind: "plot",
          x: [0, 9],
          y: [0, 70],
          curves: [{ expr: "x^2", label: "y = x^2", color: 3, dashed: true, domain: [0, 8.5] }],
          points: SQUARE_POINTS,
          caption: md`The running sums $1, 4, 9, 16, \dots$ sit exactly on $y = x^2$. The picture is convincing. It is not a proof, because it shows eight points out of infinitely many.`,
        },
        {
          kind: "key",
          title: "The principle of mathematical induction",
          body: md`Let $P(n)$ be a statement about the positive integer $n$. Suppose

- **Base case:** $P(1)$ is true.
- **Inductive step:** for every $k \ge 1$, *if* $P(k)$ is true *then* $P(k + 1)$ is true.

Then $P(n)$ is true for every positive integer $n$.

The assumption "$P(k)$ is true" inside the inductive step is called the **inductive hypothesis**. The induction may start at any integer $n_0$ instead of 1; then the conclusion is "for every $n \ge n_0$".`,
        },
        {
          kind: "why",
          title: "Why induction is valid",
          body: md`Picture a line of dominoes, one for each positive integer. The base case knocks over the first domino. The inductive step says every domino, when it falls, knocks over the next. Then they all fall: the first knocks over the second, which knocks over the third, and so on. No domino is skipped, because each one is reached from the one before it.

Here is the same idea as an argument. Suppose both parts hold but $P(n)$ fails for some $n$. Collect every $n$ where it fails. This collection is not empty, and a nonempty collection of positive integers always has a **smallest** member; call it $m$. Now $m \ne 1$, because the base case says $P(1)$ is true. So $m - 1$ is a positive integer, and $P(m - 1)$ is true, since $m$ was the smallest failure. But the inductive step turns $P(m - 1)$ into $P(m)$. So $P(m)$ is true after all, a contradiction. The only way out: there is no failure anywhere.

That is why two finite checks (one base case, one step for a general $k$) settle infinitely many statements.`,
        },
        {
          kind: "example",
          title: "The sum of the first n positive integers",
          problem: md`Prove that $1 + 2 + 3 + \cdots + n = \frac{n(n + 1)}{2}$ for every positive integer $n$.`,
          steps: [
            { math: md`P(1):\; 1 = \frac{1 \cdot 2}{2} = 1 \quad \checkmark`, note: md`**Base case.** At $n = 1$ the left side is just 1 and the right side is $\frac{1 \cdot 2}{2} = 1$.` },
            { math: md`\text{Assume } 1 + 2 + \cdots + k = \frac{k(k + 1)}{2}`, note: md`**Inductive hypothesis.** Fix some $k \ge 1$ and assume the claim holds for it. We make no assumption about $k + 1$.` },
            { math: md`1 + 2 + \cdots + k + (k + 1) = \frac{k(k + 1)}{2} + (k + 1)`, note: md`**Inductive step.** The sum to $k + 1$ is the sum to $k$ plus one more term. The hypothesis replaces the sum to $k$.` },
            { math: md`= (k + 1)\left(\frac{k}{2} + 1\right) = \frac{(k + 1)(k + 2)}{2}`, note: md`Factor out $k + 1$ and combine.` },
            { math: md`= \frac{(k + 1)\big((k + 1) + 1\big)}{2}`, note: md`This is the formula $\frac{n(n + 1)}{2}$ with $n = k + 1$. So $P(k)$ implies $P(k + 1)$.` },
            { math: md`\therefore\; P(n) \text{ for all } n \ge 1`, note: "Base case plus inductive step: by the principle of induction, the formula holds for every positive integer." },
          ],
        },
        {
          kind: "why",
          title: "Where the algebra in the step comes from",
          body: md`The inductive step always has the same shape: **write the $k + 1$ quantity in terms of the $k$ quantity**, so the hypothesis can be used, then tidy up to match the claim at $k + 1$.

- For a sum, the sum to $k + 1$ is the sum to $k$ plus the next term: $S_{k+1} = S_k + a_{k+1}$.
- For a power, peel off one factor: $4^{k+1} = 4 \cdot 4^k$.
- For a factorial, $(k + 1)! = (k + 1) \cdot k!$.
- For a polynomial like $(k + 1)^3$, expand and look for the $k$ version inside.

The goal is always known in advance: it is the claim with $k + 1$ written in place of $n$. Work out what that target looks like before you start, so you know what you are aiming for.`,
        },
        {
          kind: "proof",
          title: "The sum of the first n odd numbers is n squared",
          given: md`$n$ is a positive integer`,
          prove: md`$1 + 3 + 5 + \cdots + (2n - 1) = n^2$`,
          steps: [
            { statement: md`$P(1)$: $1 = 1^2$`, reason: "Base case, by arithmetic" },
            { statement: md`Assume $P(k)$: $1 + 3 + \cdots + (2k - 1) = k^2$ for some $k \ge 1$`, reason: "Inductive hypothesis" },
            { statement: md`$1 + 3 + \cdots + (2k - 1) + (2k + 1) = k^2 + (2k + 1)$`, reason: md`The next odd number is $2(k + 1) - 1 = 2k + 1$; substitute the hypothesis for the first $k$ terms` },
            { statement: md`$k^2 + 2k + 1 = (k + 1)^2$`, reason: "Perfect-square trinomial (Algebra 1)" },
            { statement: md`$1 + 3 + \cdots + (2(k + 1) - 1) = (k + 1)^2$, which is $P(k + 1)$`, reason: "Steps 3 and 4" },
            { statement: md`$P(n)$ holds for every positive integer $n$`, reason: "Principle of mathematical induction, from steps 1 and 5" },
          ],
        },
        {
          kind: "check",
          prompt: md`In the induction proof of $2 + 4 + 6 + \cdots + 2n = n(n + 1)$, the hypothesis turns the sum to $k + 1$ into $k(k + 1) + 2(k + 1)$. Simplify this to the form the claim predicts at $n = k + 1$. Write it factored, like (k+1)(k+2).`,
          answer: "(k+1)(k+2)",
          simplified: true,
          explain: md`Both terms share $k + 1$: $k(k + 1) + 2(k + 1) = (k + 1)(k + 2)$. That is $n(n + 1)$ with $n = k + 1$, so the step is done.`,
        },
        {
          kind: "text",
          body: md`Induction is not only for sums. Any statement indexed by $n$ is fair game: divisibility, inequalities, facts about powers.

**Divisibility.** Claim: $4^n - 1$ is divisible by 3 for every $n \ge 1$. The first values are $3, 15, 63, 255$: all multiples of 3. For the proof, "divisible by 3" means "equals $3m$ for some integer $m$".

- Base case: $4^1 - 1 = 3 = 3 \cdot 1$.
- Hypothesis: $4^k - 1 = 3m$ for some integer $m$.
- Step: $4^{k+1} - 1 = 4 \cdot 4^k - 1 = 4(4^k - 1) + 3 = 4 \cdot 3m + 3 = 3(4m + 1)$.

The trick in the step was to write $4 \cdot 4^k - 1$ as $4(4^k - 1) + 3$: subtract and add 4 so the hypothesis quantity $4^k - 1$ appears. What remains, $3(4m + 1)$, is visibly a multiple of 3. So $P(k)$ gives $P(k + 1)$, and the claim holds for all $n$.`,
        },
        {
          kind: "example",
          title: "An inequality, starting at n = 4",
          problem: md`Prove that $n! > 2^n$ for every integer $n \ge 4$. (Recall $n! = 1 \cdot 2 \cdot 3 \cdots n$.)`,
          steps: [
            { math: md`1! = 1 < 2,\quad 2! = 2 < 4,\quad 3! = 6 < 8`, note: md`The claim is **false** for $n = 1, 2, 3$. That is fine: induction can start wherever the claim starts being true.` },
            { math: md`P(4):\; 4! = 24 > 16 = 2^4 \quad \checkmark`, note: md`**Base case** at $n_0 = 4$.` },
            { math: md`\text{Assume } k! > 2^k \text{ for some } k \ge 4`, note: "**Inductive hypothesis.**" },
            { math: md`(k + 1)! = (k + 1) \cdot k!`, note: md`**Step.** Write the $k + 1$ quantity in terms of the $k$ quantity.` },
            { math: md`> (k + 1) \cdot 2^k`, note: md`By the hypothesis, $k! > 2^k$, and multiplying by the positive number $k + 1$ keeps the inequality.` },
            { math: md`\ge 2 \cdot 2^k = 2^{k + 1}`, note: md`Since $k \ge 4$, $k + 1 \ge 5 > 2$. So $(k + 1)! > 2^{k + 1}$: that is $P(k + 1)$.` },
            { math: md`\therefore\; n! > 2^n \text{ for all } n \ge 4`, note: "Base case at 4 plus the step: every domino from the fourth onward falls." },
          ],
        },
        {
          kind: "key",
          title: "How to write an induction proof",
          body: md`- **State $P(n)$** clearly, and say where it starts ($n \ge n_0$).
- **Base case.** Check $P(n_0)$ by direct computation.
- **Inductive hypothesis.** "Assume $P(k)$ holds for some particular $k \ge n_0$." Write out what that says.
- **Inductive step.** Starting from the $k + 1$ version of the quantity, rewrite it so the hypothesis applies, then simplify until it matches $P(k + 1)$.
- **Conclusion.** "By the principle of mathematical induction, $P(n)$ holds for all $n \ge n_0$."

Know your target before you start: write down $P(k + 1)$ explicitly, then aim the algebra at it.`,
        },
        {
          kind: "why",
          title: "Why both parts are needed",
          body: md`Drop the base case and the argument collapses. Take the claim "$n \ge 5$ for every positive integer $n$". The inductive step is fine: if $k \ge 5$ then $k + 1 \ge 5$. But the claim is false, because $P(1)$ fails. A step with nothing to start from proves nothing. The first domino was never pushed.

Drop the step and you are back to checking cases. The statement "$n^2 - n + 41$ is prime" holds for $n = 1, 2, \dots, 40$ (forty base cases!) and fails at $n = 41$, where it equals $41^2$. Finitely many checks never cover infinitely many integers.

One more trap: the step must prove $P(k + 1)$ **from** $P(k)$. Assuming $P(k + 1)$ and working backwards to something true is not the same thing, because false statements can also lead to true ones ($1 = 2$ implies $0 = 0$).`,
        },
        {
          kind: "check",
          prompt: md`To prove by induction that $5^n - 1$ is divisible by 4 for all $n \ge 1$, which statement is the inductive hypothesis?`,
          choices: [
            md`$5^k - 1$ is divisible by 4, for one particular $k \ge 1$`,
            md`$5^{k + 1} - 1$ is divisible by 4`,
            md`$5^n - 1$ is divisible by 4 for every $n \ge 1$`,
            md`$5^1 - 1$ is divisible by 4`,
          ],
          accept: [md`$5^k - 1$ is divisible by 4, for one particular $k \ge 1$`],
          explain: md`The hypothesis is the claim at a single fixed $k$. From it the step must prove the $k + 1$ version: $5^{k+1} - 1 = 5(5^k - 1) + 4$, a multiple of 4 plus 4. The statement about every $n$ is the theorem itself, and $5^1 - 1 = 4$ is the base case.`,
        },
      ],
      practice: [checkSmallCases, nameTheParts, inductiveStepAlgebra],
    },
    {
      id: slug("Convergence intuition"),
      title: "Convergence intuition",
      summary: "What it means for a sequence to approach a limit, how to find limits as n grows without bound, and how to tell convergence from divergence.",
      blocks: [
        {
          kind: "text",
          body: md`Algebra 2 Unit 7 was about sequences with formulas: arithmetic, geometric, and their sums. Now we ask a different question about a sequence. Not "what is the 50th term?" but "where are the terms heading?"

Take $a_n = \frac{3n + 1}{n}$:

$$\begin{array}{c|cccccccc} n & 1 & 2 & 3 & 4 & 10 & 100 & 1000 & 10000 \\ \hline a_n & 4 & 3.5 & 3.333 & 3.25 & 3.1 & 3.01 & 3.001 & 3.0001 \end{array}$$

The terms never equal 3. But they get closer and closer to 3, and once they are close they stay close. We say the sequence **converges to 3**, and write $\lim_{n \to \infty} a_n = 3$ or $a_n \to 3$.`,
        },
        {
          kind: "plot",
          x: [0, 21],
          y: [1.5, 4.5],
          points: SEQ_POINTS,
          hlines: [
            { y: 3, label: "y = 3" },
            { y: "3 + d", label: "3 + d" },
            { y: "3 - d", label: "3 - d" },
          ],
          params: [{ name: "d", min: 0.05, max: 1, step: 0.05, value: 0.5 }],
          caption: md`The terms $a_n = \frac{3n + 1}{n}$, plotted against $n$. Slide $d$ to narrow the band around 3. However thin you make it, from some $n$ onward every term is inside, and none ever leaves again. With $d = {d}$, the distance $|a_n - 3| = \frac{1}{n}$ is below $d$ as soon as $n > {=1/d}$.`,
        },
        {
          kind: "key",
          title: "The limit of a sequence",
          body: md`A sequence $a_n$ **converges to** $L$, written $\lim_{n \to \infty} a_n = L$, when the terms eventually stay as close to $L$ as you like. Precisely: for any distance $d > 0$ you name, there is a point $N$ past which every term satisfies $|a_n - L| < d$.

The distance is traditionally called $\varepsilon$ (epsilon), and the phrase "for any $\varepsilon > 0$ there is an $N$" is the formal definition you will meet in calculus. The idea is exactly the band in the picture.

A sequence that converges to some number is **convergent**. Otherwise it **diverges**: it may run off without bound, or hop around without settling.`,
        },
        {
          kind: "why",
          title: "Why (3n + 1)/n converges to 3, from the definition",
          body: md`Split the fraction: $a_n = \frac{3n + 1}{n} = 3 + \frac{1}{n}$. So the distance from 3 is

$$|a_n - 3| = \frac{1}{n}.$$

Name any distance $d$. Then $\frac{1}{n} < d$ exactly when $n > \frac{1}{d}$. For $d = 0.01$, that is $n > 100$: every term from $a_{101}$ onward is within $0.01$ of 3. For $d = 0.000001$, every term past $n = 1{,}000{,}000$ is within a millionth. Whatever $d$ is, $\frac{1}{d}$ is a number, and the terms past it are all inside the band. That is the definition, satisfied.

The same argument shows the two basic facts everything else rests on:

- $\dfrac{1}{n} \to 0$, and more generally $\dfrac{c}{n^p} \to 0$ for any constant $c$ and any power $p > 0$.
- A constant sequence $a_n = c$ converges to $c$.`,
        },
        {
          kind: "why",
          title: "Why limits respect arithmetic",
          body: md`Suppose $a_n \to A$ and $b_n \to B$. Then

$$a_n + b_n \to A + B,\qquad a_n b_n \to AB,\qquad \frac{a_n}{b_n} \to \frac{A}{B} \;(B \ne 0).$$

The reason for the sum: far enough out, $a_n$ is within $d$ of $A$ and $b_n$ is within $d$ of $B$, so $a_n + b_n$ is within $2d$ of $A + B$. Since $d$ can be as small as we like, so can $2d$. Products and quotients work the same way with slightly more bookkeeping: small errors in the inputs make a small error in the output.

So limits can be computed piece by piece. To find the limit of a fraction, we rewrite it so every piece is something whose limit we know: constants, and things like $\frac{c}{n^p}$ that go to 0.`,
        },
        {
          kind: "example",
          title: "A ratio of polynomials",
          problem: md`Find $\lim_{n \to \infty} \frac{2n^2 - n}{n^2 + 5}$.`,
          steps: [
            { math: md`\frac{2n^2 - n}{n^2 + 5} = \frac{\frac{2n^2}{n^2} - \frac{n}{n^2}}{\frac{n^2}{n^2} + \frac{5}{n^2}}`, note: md`Divide every term, top and bottom, by $n^2$, the highest power present. Dividing top and bottom by the same nonzero number doesn't change the fraction.` },
            { math: md`= \frac{2 - \frac{1}{n}}{1 + \frac{5}{n^2}}`, note: "Simplify each term." },
            { math: md`\frac{1}{n} \to 0,\qquad \frac{5}{n^2} \to 0`, note: "The basic facts." },
            { math: md`\lim_{n \to \infty} a_n = \frac{2 - 0}{1 + 0} = 2`, note: md`Limits respect arithmetic, so take the limit of each piece. Check: $a_{1000} = \frac{1{,}999{,}000}{1{,}000{,}005} \approx 1.99899$.` },
          ],
        },
        {
          kind: "key",
          title: "Limits of rational sequences",
          body: md`For $a_n = \frac{p(n)}{q(n)}$ with polynomials $p$ and $q$, divide top and bottom by the highest power of $n$ in the denominator. Then:

- **Degree of $p$ less than degree of $q$:** $a_n \to 0$. The bottom grows faster.
- **Equal degrees:** $a_n \to$ the ratio of the leading coefficients.
- **Degree of $p$ greater than degree of $q$:** the terms grow without bound; the sequence diverges.

This is the same end-behavior reasoning as for rational functions in Unit 2, read along the integers.`,
        },
        {
          kind: "check",
          prompt: md`Find $\lim_{n \to \infty} \frac{5n - 2}{n + 3}$.`,
          answer: "5",
          explain: md`Divide top and bottom by $n$: $\frac{5 - 2/n}{1 + 3/n} \to \frac{5 - 0}{1 + 0} = 5$. Equal degrees, so the ratio of leading coefficients.`,
        },
        {
          kind: "plot",
          x: [0, 13],
          y: [-2.5, 2.5],
          points: GEOM_POINTS,
          hlines: [{ y: 0 }],
          params: [{ name: "r", min: -1.5, max: 1.5, step: 0.1, value: 0.7 }],
          caption: md`The geometric sequence $a_n = r^n$ with $r = {r}$. For $|r| < 1$ the points sink to 0 (hopping across the axis when $r$ is negative). At $r = 1$ they sit at 1 forever. Past 1 they run off the top. At $r = -1$ they alternate between $-1$ and 1 and never settle: no limit.`,
        },
        {
          kind: "example",
          title: "Bernoulli's inequality, by induction",
          problem: md`Prove that $(1 + x)^n \ge 1 + nx$ for every $n \ge 1$ and every $x > -1$. (We need it for the theorem that follows.)`,
          steps: [
            { math: md`P(1):\; (1 + x)^1 = 1 + x \ge 1 + 1 \cdot x \quad \checkmark`, note: "Base case: both sides are equal." },
            { math: md`\text{Assume } (1 + x)^k \ge 1 + kx`, note: md`Inductive hypothesis, for some $k \ge 1$.` },
            { math: md`(1 + x)^{k + 1} = (1 + x)(1 + x)^k \ge (1 + x)(1 + kx)`, note: md`Peel off one factor. Since $x > -1$, $1 + x > 0$, so multiplying the hypothesis by it keeps the direction.` },
            { math: md`(1 + x)(1 + kx) = 1 + (k + 1)x + kx^2 \ge 1 + (k + 1)x`, note: md`Expand; $kx^2 \ge 0$, so dropping it can only make the right side smaller.` },
            { math: md`\therefore\; (1 + x)^n \ge 1 + nx \text{ for all } n \ge 1`, note: md`Steps 3 and 4 give $P(k + 1)$. By induction, done. In words: compound growth beats simple growth.` },
          ],
        },
        {
          kind: "proof",
          title: "Powers of a number between -1 and 1 go to 0",
          given: md`$|r| < 1$`,
          prove: md`$\lim_{n \to \infty} r^n = 0$`,
          steps: [
            { statement: md`If $r = 0$, every term is 0 and the limit is 0. Assume $0 < |r| < 1$.`, reason: "The trivial case first" },
            { statement: md`$\frac{1}{|r|} > 1$, so $\frac{1}{|r|} = 1 + x$ for some $x > 0$`, reason: md`The reciprocal of a number strictly between 0 and 1 is greater than 1; set $x = \frac{1}{|r|} - 1$` },
            { statement: md`$\left(\frac{1}{|r|}\right)^n = (1 + x)^n \ge 1 + nx > nx$`, reason: "Bernoulli's inequality, proved above by induction" },
            { statement: md`$|r^n| = |r|^n < \dfrac{1}{nx}$`, reason: md`Take reciprocals of positive numbers; the inequality flips` },
            { statement: md`Given any $d > 0$, for every $n > \dfrac{1}{dx}$ we have $|r^n - 0| < \dfrac{1}{nx} < d$`, reason: md`$n > \frac{1}{dx}$ means $nx > \frac{1}{d}$, so $\frac{1}{nx} < d$` },
            { statement: md`$r^n \to 0$`, reason: md`Definition of the limit, with $N = \frac{1}{dx}$` },
          ],
        },
        {
          kind: "text",
          body: md`Divergence comes in two flavors.

**Running away.** $a_n = \frac{n^2}{n + 1}$ grows past every bound: $a_{100} \approx 99$, $a_{1000} \approx 999$. People sometimes write $a_n \to \infty$, which is a convenient shorthand, but $\infty$ is not a number and this sequence has **no limit**. The same goes for $r^n$ with $r > 1$: by Bernoulli, $r^n \ge 1 + n(r - 1)$, which passes any bound.

**Never settling.** $a_n = (-1)^n$ is $-1, 1, -1, 1, \dots$. No number $L$ has all the later terms within $0.5$ of it, because the terms are always 2 apart. A subtler one: $a_n = (-1)^n \frac{n}{n + 1}$ has even terms creeping up toward 1 and odd terms creeping down toward $-1$. Each half looks convergent; the whole sequence is not.

Contrast $a_n = \frac{(-1)^n}{n}$: the signs alternate, but $|a_n| = \frac{1}{n} \to 0$, so the hops shrink and the sequence converges to 0. Alternating signs are fine; what matters is whether the distance to $L$ goes to 0.`,
        },
        {
          kind: "example",
          title: "A limit that looks like infinity minus infinity",
          problem: md`Find $\lim_{n \to \infty} \left(\sqrt{n^2 + 4n} - n\right)$.`,
          steps: [
            { math: md`\sqrt{n^2 + 4n} \to \infty \text{ and } n \to \infty`, note: md`Both pieces run off, so the difference is not obviously anything. Try $n = 100$: $\sqrt{10400} - 100 \approx 1.98$. Interesting.` },
            { math: md`\sqrt{n^2 + 4n} - n = \frac{(\sqrt{n^2 + 4n} - n)(\sqrt{n^2 + 4n} + n)}{\sqrt{n^2 + 4n} + n}`, note: "Multiply by the conjugate over itself: a fraction equal to 1." },
            { math: md`= \frac{(n^2 + 4n) - n^2}{\sqrt{n^2 + 4n} + n} = \frac{4n}{\sqrt{n^2 + 4n} + n}`, note: md`$(\sqrt{u} - n)(\sqrt{u} + n) = u - n^2$: the roots are gone from the top.` },
            { math: md`= \frac{4}{\sqrt{1 + \frac{4}{n}} + 1}`, note: md`Divide top and bottom by $n$. Inside the root, $n = \sqrt{n^2}$, so $\frac{\sqrt{n^2 + 4n}}{n} = \sqrt{1 + \frac{4}{n}}$.` },
            { math: md`\to \frac{4}{\sqrt{1 + 0} + 1} = 2`, note: md`$\frac{4}{n} \to 0$. The limit is 2, matching the $1.98$ we saw at $n = 100$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Does $a_n = (-1)^n \dfrac{n}{n + 1}$ converge?`,
          choices: ["no, it has no limit", "yes, to 1", "yes, to 0", "yes, to -1"],
          accept: ["no, it has no limit"],
          explain: md`The even terms $\frac{2}{3}, \frac{4}{5}, \frac{6}{7}, \dots$ approach 1 while the odd terms $-\frac{1}{2}, -\frac{3}{4}, \dots$ approach $-1$. The terms keep hopping a distance near 2, so no single $L$ has all later terms close to it. It diverges.`,
        },
        {
          kind: "why",
          title: "Why a recursive sequence's limit must satisfy its own rule",
          body: md`Some sequences are given by a rule from one term to the next. Start with $a_1 = 2$ and let $a_{n+1} = \frac{1}{2}\left(a_n + \frac{2}{a_n}\right)$:

$$2,\quad 1.5,\quad 1.41667,\quad 1.414216,\quad 1.4142136, \dots$$

It looks like it converges to $\sqrt{2} \approx 1.41421356$. Here is why that is the only candidate. Suppose $a_n \to L$ with $L \neq 0$. Then $a_{n+1} \to L$ too (it is the same sequence, shifted by one), and by the arithmetic of limits the right side $\frac{1}{2}\left(a_n + \frac{2}{a_n}\right) \to \frac{1}{2}\left(L + \frac{2}{L}\right)$. Both sides of the rule converge, and to the same thing, so

$$L = \frac{1}{2}\left(L + \frac{2}{L}\right) \;\Rightarrow\; 2L = L + \frac{2}{L} \;\Rightarrow\; L^2 = 2.$$

The positive terms force $L = \sqrt{2}$. One caution: this finds what the limit must be **if it exists**. Whether it exists is a separate question, which calculus answers. Here the terms visibly settle, and this is in fact an ancient method for computing square roots.`,
        },
        {
          kind: "text",
          body: md`Two threads to carry forward.

From Algebra 2 Unit 6, $\left(1 + \frac{1}{n}\right)^n \to e$. The terms $2, 2.25, 2.370, 2.441, \dots$ climb toward $2.71828\dots$ and never pass it. That limit **defines** $e$, and it is the first important number in mathematics that is only reachable as a limit.

And in Unit 8, the same idea of "closer and closer, and staying close" will be applied not to $n \to \infty$ but to $x \to a$: what a function approaches as its input approaches a point. That is the limit of calculus, and the intuition is the one you have just built.`,
        },
      ],
      practice: [sequenceLimit, describeBehavior, howFarOut, recursiveLimit],
    },
  ],
};
