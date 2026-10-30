import { frac, fracTex, gcd, paren, poly, signed } from "../../math/random";
import type { Rng } from "../../math/random";
import { NO_SOLUTION } from "../algebra1/unit2";
import { md, type Figure, type Generator, type Problem, type Step, type Unit } from "../types";

// ── Shared wording ──────────────────────────────────────────────────────────

const NOT_REAL = ["not real", "not a real number", "no real number", "no real value", "no real root", "undefined", "none"];
const REAL_NOTE = md`If it isn't a real number, type **not real**.`;
const ROOT_TYPING = md`Type $\sqrt[3]{5}$ as 5^(1/3), and $\sqrt[3]{-5}$ as -5^(1/3).`;
const SOLS = md`Give all real solutions, separated by commas. If there are none, type **no solution**.`;
const SOLS_ROOT = md`Give all real solutions, separated by commas. ${ROOT_TYPING} If there are none, type **no solution**.`;
const POWER_OF_X = md`Assume $x > 0$. Write the answer as a single power of $x$, with the exponent as a fraction in parentheses, like x^(a/b).`;
const DOMAIN_NOTE = md`Write it as an inequality, like x >= 2, or in interval notation, like [2, inf). If every real number works, type **all real numbers**.`;
const RANGE_NOTE = md`Write it as an inequality in $y$, like y >= 2, or in interval notation, like [2, inf). If every real number works, type **all real numbers**.`;
const ALL_REAL = ["all real numbers", "all reals", "all real x", "all real y", "every real number", "all numbers", "R"];

// ── Formatting helpers ──────────────────────────────────────────────────────

/** The nth root of `inner` as LaTeX; index 2 is a plain square root. */
const root = (n: number, inner: string | number) => (n === 2 ? md`\sqrt{${inner}}` : md`\sqrt[${n}]{${inner}}`);

/** A coefficient in front of something: 1 -> "", -1 -> "-". */
const co = (a: number) => (a === 1 ? "" : a === -1 ? "-" : String(a));

/** " + k", " - k", or "" for 0. */
const plusK = (k: number) => (k ? ` ${signed(k)}` : "");

/** bx + c, written by hand. */
const lin = (b: number, c: number) => poly([[b, "x"], [c, ""]]);

/** b · b · ... · b (n factors) as LaTeX, with negatives in parentheses. */
const factors = (b: number, n: number) => Array.from({ length: n }, () => (b < 0 ? `(${b})` : String(b))).join(" \\cdot ");

/** A fraction exponent p/q as LaTeX for inside ^{...}: "5/6", "-2/3", or "2". */
const ex = (p: number, q: number) => {
  if (q < 0) [p, q] = [-p, -q];
  const g = gcd(p, q) || 1;
  return q / g === 1 ? String(p / g) : `${p / g}/${q / g}`;
};

/** x^(p/q) as typed answer text, reduced. */
const powX = (p: number, q: number) => {
  const e = ex(p, q);
  return e.includes("/") ? `x^(${e})` : e === "1" ? "x" : `x^${e}`;
};

/** x^{p/q} as LaTeX, reduced. */
const powXTex = (p: number, q: number) => {
  const e = ex(p, q);
  return e === "1" ? "x" : `x^{${e}}`;
};

const lcm = (a: number, b: number) => (a * b) / gcd(a, b);

const ROOT_NAME: Record<number, string> = { 2: "square root", 3: "cube root", 4: "fourth root", 5: "fifth root", 6: "sixth root" };
const POWER_NAME: Record<number, string> = { 2: "square", 3: "cube", 4: "fourth power", 5: "fifth power", 6: "sixth power" };

/** The typed answer for the real nth root of m (m not a perfect power): "5^(1/3)" or "-5^(1/3)". */
const rootText = (m: number, n: number) => (m < 0 ? `-${-m}^(1/${n})` : `${m}^(1/${n})`);

// ── Lesson 1: Nth roots ─────────────────────────────────────────────────────

const evalRoot: Generator = (r): Problem => {
  const kind = r.pick([0, 0, 1, 1, 2, 3, 4]);
  if (kind === 0) {
    const n = r.pick([3, 3, 4, 5]);
    const b = n === 3 ? r.int(2, 6) : r.int(2, 3);
    const a = b ** n;
    return {
      prompt: md`Evaluate $${root(n, a)}$. ${REAL_NOTE}`,
      answer: String(b),
      hint: md`Which number, used as a factor ${n} times, gives ${a}? Try small numbers: $2^${n} = ${2 ** n}$, $3^${n} = ${3 ** n}$, and so on.`,
      solution: [
        { math: md`${factors(b, n)} = ${a}`, note: md`So ${b} is a ${ROOT_NAME[n]} of ${a}.` },
        {
          math: md`${root(n, a)} = ${b}`,
          note: n % 2 ? md`The index ${n} is odd, so this is the only real ${ROOT_NAME[n]}.` : md`$-${b}$ works too, since an even power hides the sign. The principal root is the nonnegative one.`,
        },
      ],
    };
  }
  if (kind === 1) {
    const n = r.pick([3, 3, 5]);
    const b = n === 3 ? r.int(2, 6) : r.int(2, 3);
    const a = b ** n;
    return {
      prompt: md`Evaluate $${root(n, -a)}$. ${REAL_NOTE}`,
      answer: String(-b),
      verify: [`x^${n} = ${-a}`],
      hint: md`The index is odd, so a negative radicand is fine. Pull the sign out: $${root(n, -a)} = -${root(n, a)}$.`,
      solution: [
        { math: md`${root(n, -a)} = -${root(n, a)}`, note: md`For an odd index, $\sqrt[n]{-a} = -\sqrt[n]{a}$.` },
        { math: md`= -${b}`, note: md`$${b}^${n} = ${a}$.` },
        { math: md`${factors(-b, n)} = ${-a} \;\checkmark`, note: md`An odd number of negative factors gives a negative product.` },
      ],
    };
  }
  if (kind === 2) {
    const n = r.pick([2, 3, 3, 4]);
    const max = n === 2 ? 9 : n === 3 ? 5 : 3;
    let p = r.int(1, max);
    let q = r.int(2, max);
    while (gcd(p, q) !== 1) [p, q] = [r.int(1, max), r.int(2, max)];
    const neg = n === 3 && r.next() < 0.5;
    const [P, Q] = [p ** n, q ** n];
    const inside = neg ? md`-\frac{${P}}{${Q}}` : md`\frac{${P}}{${Q}}`;
    const answer = frac(neg ? -p : p, q);
    return {
      prompt: md`Evaluate $${root(n, inside)}$. Give a fraction, like 2/5. ${REAL_NOTE}`,
      answer,
      ...(neg ? { verify: [`x^3 = -${P}/${Q}`] } : {}),
      simplified: true,
      hint: md`Take the ${ROOT_NAME[n]} of the top and of the bottom separately.`,
      solution: [
        { math: md`${root(n, inside)} = ${neg ? "-" : ""}\frac{${root(n, P)}}{${root(n, Q)}}`, note: md`The quotient rule for roots${neg ? ", after pulling the sign out of the odd root" : ""}.` },
        { math: fracTex(neg ? -p : p, q), note: md`$${p}^${n} = ${P}$ and $${q}^${n} = ${Q}$.` },
      ],
    };
  }
  if (kind === 3) {
    const c = r.int(2, 4);
    const b1 = r.int(2, 5);
    const n2 = r.pick([4, 5]);
    const b2 = r.int(2, 3);
    const s = r.sign();
    const value = c * b1 + s * b2;
    return {
      prompt: md`Evaluate $${c}${root(3, b1 ** 3)} ${s > 0 ? "+" : "-"} ${root(n2, b2 ** n2)}$. ${REAL_NOTE}`,
      answer: String(value),
      hint: "Work out each root on its own, then do the arithmetic.",
      solution: [
        { math: md`${c} \cdot ${b1} ${s > 0 ? "+" : "-"} ${b2}`, note: md`$${b1}^3 = ${b1 ** 3}$ and $${b2}^${n2} = ${b2 ** n2}$.` },
        { math: String(value), note: "" },
      ],
    };
  }
  const n = r.pick([2, 4, 4, 6]);
  const b = n === 6 ? 2 : r.int(2, n === 2 ? 9 : 3);
  const a = b ** n;
  if (r.next() < 0.5) {
    return {
      prompt: md`Evaluate $${root(n, -a)}$. ${REAL_NOTE}`,
      accept: n === 2 ? [...NOT_REAL, `${b}i`, `i${b}`] : NOT_REAL,
      hint: md`The index ${n} is even. Can an even power of a real number be negative?`,
      solution: [
        { math: md`${b}^${n} = ${a} \quad\text{and}\quad (-${b})^${n} = ${a}`, note: "An even power pairs up the negative signs, so it is never negative." },
        { math: md`${root(n, -a)} \text{ is not real}`, note: md`No real number has ${POWER_NAME[n]} $${-a}$, so there is no real ${ROOT_NAME[n]}.${n === 2 ? md` (Unit 2's imaginary numbers give it a meaning, $${b}i$, but not as a real number.)` : ""}` },
      ],
    };
  }
  return {
    prompt: md`Evaluate $-${root(n, a)}$. ${REAL_NOTE}`,
    answer: String(-b),
    hint: "The minus sign is outside the root. Take the root first, then the opposite.",
    solution: [
      { math: md`${root(n, a)} = ${b}`, note: md`$${b}^${n} = ${a}$. The radicand is positive, so the root is real.` },
      { math: md`-${root(n, a)} = -${b}`, note: "Then take the opposite. Compare an even root of a negative number, which isn't real." },
    ],
  };
};

const CUBEFREE = [2, 3, 4, 5, 6, 7, 9, 10];
const FOURTHFREE = [2, 3, 5, 6, 7];

const simplifyNthRoot: Generator = (r): Problem => {
  const kind = r.pick([0, 0, 1, 2, 3, 3, 4]);
  for (;;) {
    const n = kind === 3 ? 4 : kind === 4 ? 5 : 3;
    const c = n === 3 ? r.int(2, 5) : 2 + (n === 4 ? r.int(0, 1) : 0);
    const m = n === 3 ? r.pick(CUBEFREE) : n === 4 ? r.pick(FOURTHFREE) : r.pick([2, 3]);
    const N = c ** n * m;
    if (N > 400) continue;
    const sign = kind === 1 ? -1 : 1;
    const k = kind === 2 ? r.int(2, 3) : 1;
    const a = sign * k * c;
    const power = POWER_NAME[n]!;
    const shown = md`${co(k)}${root(n, sign * N)}`;
    const steps: Step[] = [];
    if (sign < 0) steps.push({ math: md`${root(n, -N)} = -${root(n, N)}`, note: "The index is odd, so the sign comes out of the root." });
    steps.push(
      { math: md`${root(n, N)} = ${root(n, md`${c ** n} \cdot ${m}`)}`, note: md`$${c ** n} = ${c}^${n}$ is the largest perfect ${power} that divides ${N}.` },
      { math: md`= ${root(n, c ** n)} \cdot ${root(n, m)} = ${c}${root(n, m)}`, note: md`Product rule for roots. ${m} has no perfect ${power} factor, so the root is done.` },
    );
    if (sign < 0) steps.push({ math: md`${root(n, -N)} = -${c}${root(n, m)}`, note: "Put the sign back." });
    if (k > 1) steps.push({ math: md`${k} \cdot ${c}${root(n, m)} = ${a}${root(n, m)}`, note: "Multiply the number in front by what came out." });
    steps.push({ math: md`(a, b) = (${a}, ${m})`, note: "" });
    return {
      prompt: md`Write $${shown}$ in the form $a${root(n, "b")}$, where $b$ is a positive whole number with no perfect ${power} factor other than 1. Give the answer as $(a, b)$.`,
      answer: `(${a}, ${m})`,
      form: "tuple",
      verify: [`a^${n} b = ${k ** n * sign * N}`],
      hint: n === 3 ? md`Perfect cubes: 8, 27, 64, 125. Find the largest one that divides ${N}.` : n === 4 ? md`Perfect fourth powers: 16, 81, 256. Find the largest one that divides ${N}.` : md`Perfect fifth powers: 32, 243. Which one divides ${N}?`,
      solution: steps,
    };
  }
};

const solvePower: Generator = (r): Problem => {
  const kind = r.pick([0, 0, 1, 1, 2, 2, 3, 3, 4]);
  if (kind === 0) {
    const n = r.pick([3, 3, 5]);
    const b = (n === 3 ? r.int(2, 5) : r.int(2, 3)) * r.sign();
    const c = b ** n;
    return {
      prompt: md`Solve $x^${n} = ${c}$. ${SOLS_ROOT}`,
      answer: String(b),
      form: "set",
      hint: md`The power is odd. How many real numbers have ${POWER_NAME[n]} ${c}?`,
      solution: [
        { math: md`x = ${root(n, c)}`, note: md`An odd power keeps the sign, so exactly one real number works. No $\pm$ here.` },
        { math: md`x = ${b}`, note: md`$${paren(b)}^${n} = ${c}$.` },
      ],
    };
  }
  if (kind === 1) {
    const n = r.pick([2, 4, 4, 6]);
    const b = n === 6 ? 2 : n === 4 ? r.int(1, 3) : r.int(2, 9);
    const c = b ** n;
    if (r.next() < 0.3) {
      return {
        prompt: md`Solve $x^${n} = ${-c}$. ${SOLS_ROOT}`,
        accept: NO_SOLUTION,
        hint: md`Can an even power of a real number be negative?`,
        solution: [
          { math: md`x^${n} \ge 0 \text{ for every real } x`, note: md`An even power pairs up the negative signs, so it is never negative.` },
          { math: md`\text{no solution}`, note: md`Nothing to the power ${n} is $${-c}$. The line $y = ${-c}$ never meets the graph of $y = x^${n}$.` },
        ],
      };
    }
    return {
      prompt: md`Solve $x^${n} = ${c}$. ${SOLS_ROOT}`,
      answer: `${b}, ${-b}`,
      form: "set",
      hint: md`The power is even, so a number and its opposite give the same result.`,
      solution: [
        { math: md`x = \pm${root(n, c)}`, note: md`An even power hides the sign, so both the principal root and its opposite work.` },
        { math: md`x = ${b} \quad\text{or}\quad x = ${-b}`, note: md`$${b}^${n} = ${c}$ and $(-${b})^${n} = ${c}$.` },
      ],
    };
  }
  if (kind === 2) {
    const n = r.pick([3, 3, 4]);
    const a = r.int(2, 5);
    const b = n === 3 ? r.nonzero(-3, 3) : r.int(1, 3);
    const d = r.nonzero(-20, 20);
    const e = a * b ** n + d;
    const steps: Step[] = [
      { math: md`${a}x^${n} = ${e - d}`, note: md`${d > 0 ? "Subtract" : "Add"} ${Math.abs(d)} on both sides.` },
      { math: md`x^${n} = ${b ** n}`, note: md`Divide by ${a}. The power is isolated now.` },
    ];
    if (n === 3) steps.push({ math: md`x = ${root(3, b ** 3)} = ${b}`, note: md`One real cube root: $${paren(b)}^3 = ${b ** 3}$.` });
    else steps.push({ math: md`x = \pm${root(4, b ** 4)} = \pm ${b}`, note: md`An even power: both $${b}$ and $-${b}$ have fourth power ${b ** 4}.` });
    return {
      prompt: md`Solve $${a}x^${n} ${signed(d)} = ${e}$. ${SOLS_ROOT}`,
      answer: n === 3 ? String(b) : `${b}, ${-b}`,
      form: "set",
      hint: "Isolate the power first, exactly like a two-step equation. Then take the root.",
      solution: steps,
    };
  }
  if (kind === 3) {
    const n = r.pick([3, 4]);
    const h = r.nonzero(-6, 6);
    const b = n === 3 ? r.nonzero(-3, 3) : r.int(1, 3);
    const c = b ** n;
    const inner = lin(1, -h);
    const steps: Step[] =
      n === 3
        ? [
            { math: md`${inner} = ${root(3, c)} = ${b}`, note: "Take the cube root of both sides. Cubing is one-to-one, so nothing is lost." },
            { math: md`x = ${h + b}`, note: md`${h > 0 ? "Add" : "Subtract"} ${Math.abs(h)}.` },
          ]
        : [
            { math: md`${inner} = \pm ${b}`, note: md`Both ${b} and $-${b}$ have fourth power ${c}.` },
            { math: md`x = ${h} + ${b} = ${h + b} \quad\text{or}\quad x = ${h} - ${b} = ${h - b}`, note: "Solve each one." },
          ];
    return {
      prompt: md`Solve $(${inner})^${n} = ${c}$. ${SOLS_ROOT}`,
      answer: n === 3 ? String(h + b) : `${h + b}, ${h - b}`,
      form: "set",
      hint: md`Treat $${inner}$ as one quantity. Which numbers have ${POWER_NAME[n]} ${c}?`,
      solution: steps,
    };
  }
  const n = r.pick([3, 3, 4]);
  const m = n === 3 ? r.pick([2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 15, 20]) * r.sign() : r.pick([2, 3, 5, 6, 7, 10, 20]);
  return {
    prompt: md`Solve $x^${n} = ${m}$. ${SOLS_ROOT}`,
    answer: n === 3 ? rootText(m, 3) : `${rootText(m, 4)}, -${rootText(m, 4)}`,
    form: "set",
    hint: md`${m < 0 ? -m : m} isn't a perfect ${POWER_NAME[n]}, so leave the answer as a root.`,
    solution:
      n === 3
        ? [
            { math: md`x = ${root(3, m)}${m < 0 ? md` = -${root(3, -m)}` : ""}`, note: md`One real cube root.${m < 0 ? " The sign comes out of an odd root." : ""} ${Math.abs(m)} has no perfect-cube factor, so this is as simple as it gets.` },
            { math: md`x \approx ${(Math.sign(m) * Math.cbrt(Math.abs(m))).toFixed(3)}`, note: md`Typed as ${rootText(m, 3)}.` },
          ]
        : [
            { math: md`x = \pm ${root(4, m)}`, note: md`An even power: the principal fourth root and its opposite.` },
            { math: md`x \approx \pm ${Math.pow(m, 0.25).toFixed(3)}`, note: md`Typed as ${rootText(m, 4)}, -${rootText(m, 4)}.` },
          ],
  };
};

// ── Lesson 2: Rational exponents ────────────────────────────────────────────

const evalRational: Generator = (r): Problem => {
  const kind = r.pick([0, 1, 1, 2, 2, 3, 3, 4]);
  if (kind === 3) {
    for (;;) {
      const n = r.pick([2, 2, 3]);
      const max = n === 2 ? 7 : 4;
      const p = r.int(1, max);
      const q = r.int(2, max);
      const m = r.pick([1, 1, 2, 3]);
      if (p === q || gcd(p, q) !== 1 || gcd(m, n) !== 1 || p ** m > 343 || q ** m > 343) continue;
      const neg = r.next() < 0.5;
      const [P, Q] = [p ** n, q ** n];
      const [top, bot] = neg ? [q ** m, p ** m] : [p ** m, q ** m];
      const base = md`\left(\frac{${P}}{${Q}}\right)`;
      const steps: Step[] = [];
      if (neg) steps.push({ math: md`${base}^{-${m}/${n}} = \left(\frac{${Q}}{${P}}\right)^{${m}/${n}}`, note: md`A negative exponent means reciprocal: $\left(\frac{a}{b}\right)^{-r} = \left(\frac{b}{a}\right)^{r}$.` });
      const [A, B, a, b] = neg ? [Q, P, q, p] : [P, Q, p, q];
      const start = neg ? "" : md`${base}^{${m}/${n}} `;
      if (m === 1) {
        steps.push({ math: md`${start}= \frac{${root(n, A)}}{${root(n, B)}} = ${fracTex(top, bot)}`, note: md`Take the root of the top and of the bottom. $${a}^${n} = ${A}$ and $${b}^${n} = ${B}$.` });
      } else {
        steps.push(
          { math: md`${start}= \left(\frac{${root(n, A)}}{${root(n, B)}}\right)^{${m}} = \left(\frac{${a}}{${b}}\right)^{${m}}`, note: md`Root first, on top and bottom. $${a}^${n} = ${A}$ and $${b}^${n} = ${B}$.` },
          { math: md`= ${fracTex(top, bot)}`, note: md`Then the power ${m}, top and bottom.` },
        );
      }
      return {
        prompt: md`Evaluate $${base}^{${neg ? "-" : ""}${m}/${n}}$. Give a fraction or a whole number.`,
        answer: frac(top, bot),
        simplified: true,
        hint: neg ? "Flip the fraction to deal with the minus sign. Then take the root, then the power." : "Take the root of the top and bottom, then raise to the power.",
        solution: steps,
      };
    }
  }
  for (;;) {
    const n = r.pick([2, 2, 3, 3, 4, 5]);
    const k = r.int(2, n === 2 ? 9 : n === 3 ? 5 : 3);
    const m = kind === 0 ? 1 : kind === 4 ? r.int(1, 3) : kind === 2 ? r.int(1, 4) : r.int(2, 5);
    if (gcd(m, n) !== 1 || k ** m > (kind === 2 ? 128 : 256)) continue;
    const b = k ** n;
    const rootStep: Step = { math: md`${root(n, b)} = ${k}`, note: md`$${k}^${n} = ${b}$.` };
    if (kind === 0) {
      return {
        prompt: md`Evaluate $${b}^{1/${n}}$.`,
        answer: String(k),
        simplified: true,
        hint: md`An exponent of $1/${n}$ means the ${ROOT_NAME[n]}.`,
        solution: [{ math: md`${b}^{1/${n}} = ${root(n, b)}`, note: md`By definition, $a^{1/n} = \sqrt[n]{a}$.` }, rootStep],
      };
    }
    if (kind === 1) {
      return {
        prompt: md`Evaluate $${b}^{${m}/${n}}$.`,
        answer: String(k ** m),
        simplified: true,
        hint: md`The denominator ${n} is a root; the numerator ${m} is a power. Take the root first.`,
        solution: [
          { math: md`${b}^{${m}/${n}} = \left(${root(n, b)}\right)^{${m}}`, note: "Root first keeps the numbers small." },
          { math: md`= ${k}^{${m}}`, note: md`$${root(n, b)} = ${k}$ because $${k}^${n} = ${b}$.` },
          { math: md`= ${k ** m}`, note: "" },
        ],
      };
    }
    if (kind === 2) {
      return {
        prompt: md`Evaluate $${b}^{-${m}/${n}}$. Give a fraction, like 1/8.`,
        answer: frac(1, k ** m),
        simplified: true,
        hint: "A negative exponent means reciprocal. It doesn't make the answer negative.",
        solution: [
          { math: md`${b}^{-${m}/${n}} = \frac{1}{${b}^{${m}/${n}}}`, note: md`$a^{-r} = \frac{1}{a^r}$.` },
          m === 1
            ? { math: md`= \frac{1}{${root(n, b)}}`, note: md`$${root(n, b)} = ${k}$.` }
            : { math: md`= \frac{1}{\left(${root(n, b)}\right)^{${m}}} = \frac{1}{${k}^{${m}}}`, note: md`$${root(n, b)} = ${k}$.` },
          { math: fracTex(1, k ** m), note: "" },
        ],
      };
    }
    const e = m === 1 ? `1/${n}` : `${m}/${n}`;
    return {
      prompt: md`Evaluate $-${b}^{${e}}$.`,
      answer: String(-(k ** m)),
      simplified: true,
      hint: md`The exponent applies only to ${b}, just as $-3^2 = -9$. The minus waits until the end.`,
      solution: [
        { math: md`-\left(${b}^{${e}}\right)`, note: "Exponents come before the negation (Algebra 1, Unit 1)." },
        m === 1
          ? { math: md`= -${root(n, b)}`, note: md`$${root(n, b)} = ${k}$.` }
          : { math: md`= -\left(${root(n, b)}\right)^{${m}} = -${k}^{${m}}`, note: md`$${root(n, b)} = ${k}$. The power comes next, and the minus waits until last.` },
        { math: String(-(k ** m)), note: "" },
      ],
    };
  }
};

/** Exponents that are pleasant to add and multiply. */
const NICE: [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 3],
  [1, 4],
  [3, 4],
  [3, 2],
  [5, 2],
  [4, 3],
  [5, 3],
  [5, 4],
  [1, 6],
  [5, 6],
];

const simplifyPowers: Generator = (r): Problem => {
  const kind = r.pick([0, 0, 1, 1, 2, 2, 3]);
  if (kind === 3) {
    const n = r.pick([2, 3, 3, 4]);
    const c = r.int(2, n === 2 ? 9 : n === 3 ? 5 : 3);
    const e = n === 2 ? r.pick([2, 4]) : 2;
    const C = c ** n;
    return {
      prompt: md`Simplify $\left(${C}x^{${n * e}}\right)^{1/${n}}$.`,
      answer: `${c}x^${e}`,
      simplified: true,
      positive: true,
      hint: md`Use the power of a product: $(ab)^r = a^r b^r$. Then deal with ${C} and $x^{${n * e}}$ separately.`,
      solution: [
        { math: md`${C}^{1/${n}} \cdot \left(x^{${n * e}}\right)^{1/${n}}`, note: md`Power of a product.` },
        { math: md`${root(n, C)} \cdot x^{${n * e}/${n}}`, note: md`An exponent of $1/${n}$ is a ${ROOT_NAME[n]}, and a power of a power multiplies the exponents.` },
        { math: md`${c}x^{${e}}`, note: md`$${c}^${n} = ${C}$. The power $x^{${e}}$ is never negative, so it matches the ${ROOT_NAME[n]} for every real $x$.` },
      ],
    };
  }
  for (;;) {
    const [p1, q1] = r.pick(NICE);
    const [p2, q2] = r.pick(NICE);
    if (kind === 0) {
      const [P, Q] = [p1 * q2 + p2 * q1, q1 * q2];
      if ((P / Q) % 1 === 0 || q1 === q2) continue;
      const L = lcm(q1, q2);
      const [a, b] = [(p1 * L) / q1, (p2 * L) / q2];
      const reduced = gcd(a + b, L) > 1;
      return {
        prompt: md`Simplify $x^{${p1}/${q1}} \cdot x^{${p2}/${q2}}$. ${POWER_OF_X}`,
        answer: powX(P, Q),
        simplified: true,
        positive: true,
        hint: md`Product rule: add the exponents. Use the common denominator ${L}.`,
        solution: [
          { math: md`x^{${p1}/${q1} + ${p2}/${q2}}`, note: md`Same base, multiplied: add the exponents.` },
          { math: md`= x^{${a}/${L} + ${b}/${L}} = x^{${a + b}/${L}}`, note: md`Rewrite over the common denominator ${L}.` },
          ...(reduced ? [{ math: md`= ${powXTex(P, Q)}`, note: "Reduce the fraction in the exponent." }] : []),
        ],
      };
    }
    if (kind === 1) {
      const [P, Q] = [p1 * q2 - p2 * q1, q1 * q2];
      if (P <= 0 || (P / Q) % 1 === 0 || q1 === q2) continue;
      const L = lcm(q1, q2);
      const [a, b] = [(p1 * L) / q1, (p2 * L) / q2];
      return {
        prompt: md`Simplify $\frac{x^{${p1}/${q1}}}{x^{${p2}/${q2}}}$. ${POWER_OF_X}`,
        answer: powX(P, Q),
        simplified: true,
        positive: true,
        hint: md`Quotient rule: subtract the bottom exponent from the top one. Use the common denominator ${L}.`,
        solution: [
          { math: md`x^{${p1}/${q1} - ${p2}/${q2}}`, note: md`Same base, divided: subtract the exponents.` },
          { math: md`= x^{${a}/${L} - ${b}/${L}} = x^{${a - b}/${L}}`, note: md`Common denominator ${L}.` },
          ...(gcd(a - b, L) > 1 ? [{ math: md`= ${powXTex(P, Q)}`, note: "Reduce the fraction in the exponent." }] : []),
        ],
      };
    }
    const [P, Q] = [p1 * p2, q1 * q2];
    if ((P / Q) % 1 === 0 || (p1 === 1 && p2 === 1 && r.next() < 0.5)) continue;
    return {
      prompt: md`Simplify $\left(x^{${p1}/${q1}}\right)^{${p2}/${q2}}$. ${POWER_OF_X}`,
      answer: powX(P, Q),
      simplified: true,
      positive: true,
      hint: "Power of a power: multiply the exponents.",
      solution: [
        { math: md`x^{\frac{${p1}}{${q1}} \cdot \frac{${p2}}{${q2}}} = x^{${P}/${Q}}`, note: "Multiply tops and multiply bottoms." },
        ...(gcd(P, Q) > 1 ? [{ math: md`= ${powXTex(P, Q)}`, note: "Reduce the fraction in the exponent." }] : []),
      ],
    };
  }
};

const rootsToPowers: Generator = (r): Problem => {
  const kind = r.pick([0, 1, 2, 2, 3, 4, 5]);
  const done = (p: number, q: number, steps: Step[], prompt: string, hint: string, finish = gcd(p, q) > 1): Problem => ({
    prompt: md`Simplify $${prompt}$. ${POWER_OF_X}`,
    answer: powX(p, q),
    simplified: true,
    positive: true,
    hint,
    solution: finish ? [...steps, { math: md`= ${powXTex(p, q)}`, note: gcd(p, q) > 1 ? "Reduce the fraction in the exponent." : "" }] : steps,
  });
  if (kind === 0 || kind === 1) {
    for (;;) {
      const n = r.pick([2, 3, 4, 5]);
      const m = r.pick([3, 5, 7]);
      if (gcd(m, n) !== 1) continue;
      const prompt = kind === 0 ? root(n, `x^{${m}}`) : md`\left(${root(n, "x")}\right)^{${m}}`;
      return done(m, n, [{ math: md`${prompt} = x^{${m}/${n}}`, note: md`The index ${n} becomes the denominator and the power ${m} the numerator: $\sqrt[n]{a^m} = (\sqrt[n]{a})^m = a^{m/n}$.` }], prompt, "The index of the root is the denominator of the exponent.");
    }
  }
  if (kind === 2) {
    const [n, m] = r.pick([[2, 3], [2, 4], [3, 4], [2, 6], [3, 6], [4, 6]] as const);
    const swap = r.next() < 0.5;
    const [a, b] = swap ? [m, n] : [n, m];
    const L = lcm(a, b);
    return done(
      L / a + L / b,
      L,
      [
        { math: md`x^{1/${a}} \cdot x^{1/${b}}`, note: "Rewrite each root as a power. Roots with different indexes can't be combined as roots, but powers of the same base can." },
        { math: md`= x^{${L / a}/${L} + ${L / b}/${L}} = x^{${L / a + L / b}/${L}}`, note: md`Product rule: add the exponents, over the common denominator ${L}.` },
      ],
      md`${root(a, "x")} \cdot ${root(b, "x")}`,
      "Write each root as a power of x, then use the product rule.",
    );
  }
  if (kind === 3) {
    const [n, m] = r.pick([[2, 3], [2, 4], [3, 4], [2, 6], [3, 6]] as const);
    const L = lcm(n, m);
    return done(
      L / n - L / m,
      L,
      [
        { math: md`\frac{x^{1/${n}}}{x^{1/${m}}}`, note: "Rewrite each root as a power." },
        { math: md`= x^{${L / n}/${L} - ${L / m}/${L}} = x^{${L / n - L / m}/${L}}`, note: md`Quotient rule: subtract, over the common denominator ${L}.` },
      ],
      md`\frac{${root(n, "x")}}{${root(m, "x")}}`,
      "Write each root as a power of x, then use the quotient rule.",
    );
  }
  if (kind === 4) {
    const outer = r.pick([2, 3]);
    const inner = r.pick([2, 3]);
    return done(
      1,
      outer * inner,
      [
        { math: md`\left(x^{1/${inner}}\right)^{1/${outer}}`, note: md`The inside root is $x^{1/${inner}}$; the outside root raises that to the power $1/${outer}$.` },
        { math: md`= x^{\frac{1}{${inner}} \cdot \frac{1}{${outer}}}`, note: "Power of a power: multiply." },
      ],
      root(outer, root(inner, "x")),
      "Work from the inside out. A root of a root is a power of a power.",
      true,
    );
  }
  const j = r.int(1, 2);
  const n = r.pick([2, 3, 4]);
  if (r.next() < 0.5) {
    return done(
      j * n + 1,
      n,
      [
        { math: md`x^{${j}} \cdot x^{1/${n}}`, note: "Rewrite the root as a power." },
        { math: md`= x^{${j * n}/${n} + 1/${n}} = x^{${j * n + 1}/${n}}`, note: md`Add the exponents: ${j} is $${j * n}/${n}$.` },
      ],
      md`${j === 1 ? "x" : "x^2"}${root(n, "x")}`,
      "Rewrite the root as a power of x. Then the product rule applies.",
    );
  }
  const top = j + 1;
  return done(
    top * n - 1,
    n,
    [
      { math: md`\frac{x^{${top}}}{x^{1/${n}}}`, note: "Rewrite the root as a power." },
      { math: md`= x^{${top * n}/${n} - 1/${n}} = x^{${top * n - 1}/${n}}`, note: md`Subtract the exponents: ${top} is $${top * n}/${n}$.` },
    ],
    md`\frac{x^{${top}}}{${root(n, "x")}}`,
    "Rewrite the root as a power of x. Then the quotient rule applies.",
  );
};

// ── Lesson 3: Radical functions ─────────────────────────────────────────────

/** a · ⁿ√(inner) + k as LaTeX. */
const radFn = (a: number, n: number, inner: string, k: number) => md`${co(a)}${root(n, inner)}${plusK(k)}`;

/** A plot of y = a√(x - h) + k with its starting point marked. */
function sqrtFigure(a: number, h: number, k: number): Figure {
  const ys = [k, k + a * 3];
  return {
    kind: "plot",
    x: [h - 2, h + 10],
    y: [Math.min(...ys) - 2, Math.max(...ys) + 2],
    curves: [{ expr: `${a}*sqrt(x - (${h})) + (${k})`, label: md`y = f(x)` }],
    points: [{ x: h, y: k, color: 2 }],
  };
}

const radicalFeatures: Generator = (r): Problem => {
  const kind = r.pick([0, 0, 1, 1, 2, 3, 3, 4]);
  if (kind === 0) {
    const n = r.pick([2, 2, 4]);
    const b = r.nonzero(-4, 4);
    const rho = r.int(-6, 6);
    const c = -b * rho;
    const a = r.pick([1, 2, 3, -1, -2]);
    const k = r.int(-5, 5);
    const inside = lin(b, c);
    const steps: Step[] = [{ math: md`${inside} \ge 0`, note: md`The index ${n} is even, so the radicand can't be negative.` }];
    if (c !== 0) steps.push({ math: md`${co(b)}x \ge ${-c}`, note: md`${c > 0 ? "Subtract" : "Add"} ${Math.abs(c)}.` });
    if (b !== 1) steps.push({ math: md`x ${b > 0 ? "\\ge" : "\\le"} ${rho}`, note: b > 0 ? md`Divide by ${b}.` : md`Divide by ${b}. Dividing by a negative flips the inequality (Algebra 1, Unit 3).` });
    steps.push({ math: b > 0 ? md`[${rho}, \infty)` : md`(-\infty, ${rho}]`, note: "What happens outside the root doesn't change which inputs are allowed." });
    return {
      prompt: md`Find the domain of $f(x) = ${radFn(a, n, inside, k)}$. ${DOMAIN_NOTE}`,
      answer: b > 0 ? `x >= ${rho}` : `x <= ${rho}`,
      form: "inequality",
      hint: "An even root needs a radicand that is 0 or more. Solve that inequality.",
      solution: steps,
    };
  }
  if (kind === 1) {
    const a = r.pick([1, 2, 3, -1, -2, -3]);
    const h = r.int(-5, 5);
    const k = r.int(-6, 6);
    const n = r.pick([2, 2, 4]);
    const withFigure = n === 2 && r.next() < 0.5;
    return {
      prompt: md`Find the range of $f(x) = ${radFn(a, n, lin(1, -h), k)}$. ${RANGE_NOTE}`,
      answer: a > 0 ? `y >= ${k}` : `y <= ${k}`,
      form: "inequality",
      ...(withFigure ? { figure: sqrtFigure(a, h, k) } : {}),
      hint: md`The root takes every value from 0 upward. What happens to those values when you multiply by $${a}$ and then add $${k}$?`,
      solution: [
        { math: md`${root(n, lin(1, -h))} \ge 0`, note: md`A principal ${ROOT_NAME[n]} takes every value from 0 up, starting at $x = ${h}$.` },
        {
          math: md`${co(a)}${root(n, lin(1, -h))} ${a > 0 ? "\\ge" : "\\le"} 0`,
          note: a > 0 ? md`Multiplying by ${a} stretches, but the values stay 0 or more.` : md`Multiplying by ${a} flips the values: now they are 0 or **less**.`,
        },
        { math: md`f(x) ${a > 0 ? "\\ge" : "\\le"} ${k}`, note: md`Adding ${k} moves every value by ${k}. ${a > 0 ? md`So the range is $[${k}, \infty)$.` : md`So the range is $(-\infty, ${k}]$.`}` },
      ],
    };
  }
  if (kind === 2) {
    const n = r.pick([3, 3, 5]);
    const b = r.nonzero(-3, 3);
    const c = r.nonzero(-8, 8);
    const a = r.pick([1, 2, -1, -3]);
    const k = r.int(-5, 5);
    const which = r.next() < 0.5 ? "domain" : "range";
    return {
      prompt: md`Find the ${which} of $f(x) = ${radFn(a, n, lin(b, c), k)}$. ${which === "domain" ? DOMAIN_NOTE : RANGE_NOTE}`,
      answer: "(-inf, inf)",
      form: "inequality",
      accept: ALL_REAL,
      hint: md`The index is ${n}, which is odd. Can an odd root take a negative radicand?`,
      solution:
        which === "domain"
          ? [
              { math: md`${root(n, md`\text{anything}`)} \text{ is real}`, note: md`Every real number has exactly one real ${ROOT_NAME[n]}, negative numbers included.` },
              { math: md`(-\infty, \infty)`, note: md`So any $x$ can go in. The domain is all real numbers.` },
            ]
          : [
              { math: md`${root(n, "u")} \text{ takes every real value}`, note: md`Any real number $v$ is the ${ROOT_NAME[n]} of $v^${n}$, and $u = ${lin(b, c)}$ can be made equal to $v^${n}$ for some $x$.` },
              { math: md`(-\infty, \infty)`, note: md`Multiplying by ${a} and adding ${k} still reaches every real number. The range is all real numbers.` },
            ],
    };
  }
  if (kind === 3) {
    const n = r.pick([2, 2, 3, 3]);
    const a = r.pick([1, 2, 3, -1, -2]);
    const h = r.int(-6, 6);
    const k = r.int(-6, 6);
    const t = n === 2 ? r.int(1, 5) : r.nonzero(-3, 3);
    const x = h + t ** n;
    const value = a * t + k;
    const inner = lin(1, -h);
    return {
      prompt: md`Evaluate $${radFn(a, n, inner, k)}$ when $x = ${x}$.`,
      answer: String(value),
      ...(t < 0 ? { verify: [`((v ${signed(-k)})/(${a}))^3 = ${t ** 3}`] } : {}),
      hint: "Substitute, work out the radicand, take the root, then multiply and add.",
      solution: [
        ...(h === 0 ? [] : [{ math: md`${co(a)}${root(n, md`${x} ${signed(-h)}`)}${plusK(k)}`, note: "Substitute." }]),
        { math: md`${h === 0 ? "" : "= "}${co(a)}${root(n, t ** n)}${plusK(k)}`, note: h === 0 ? "Substitute." : "The radicand first: a root is a grouping symbol." },
        { math: md`= ${a === 1 ? (t < 0 ? `(${t})` : t) : a === -1 ? `-(${t})` : `${a}(${t})`}${plusK(k)}`, note: md`$${root(n, t ** n)} = ${t}$${t < 0 ? ": an odd root of a negative is negative" : ""}.` },
        { math: String(value), note: "" },
      ],
    };
  }
  const a = r.pick([1, 2, 3, -1, -2]);
  const h = r.nonzero(-6, 6);
  const k = r.nonzero(-6, 6);
  return {
    prompt: md`The graph of $y = ${radFn(a, 2, lin(1, -h), k)}$ starts at an endpoint and runs off in one direction. Give the endpoint as $(x, y)$.`,
    answer: `(${h}, ${k})`,
    form: "tuple",
    hint: "The graph starts where the radicand is 0.",
    solution: [
      { math: md`${lin(1, -h)} = 0 \Rightarrow x = ${h}`, note: "The radicand is 0 there. Any smaller $x$ makes it negative." },
      { math: md`y = ${co(a)}\sqrt{0}${plusK(k)} = ${k}`, note: md`At the start the root is 0, so the height is just $k = ${k}$.` },
      { math: md`(${h}, ${k})`, note: md`This is $(h, k)$ in $y = a\sqrt{x - h} + k$.` },
    ],
  };
};

/** Exponents m/n (n is the root) with bases b that keep x = b^n friendly. Numerators are odd, so x^(m/n) is one-to-one. */
const EQ_POWERS: [number, number, number[]][] = [
  [3, 2, [2, 3, 4, 5]],
  [5, 2, [2, 3]],
  [3, 4, [2, 3]],
  [1, 3, [2, 3, 4, 5]],
  [5, 3, [2]],
  [1, 4, [2, 3]],
  [1, 2, [3, 5, 6, 7]],
];

const rationalEquations: Generator = (r): Problem => {
  const kind = r.pick([0, 0, 1, 2, 2, 3, 4]);
  if (kind === 1) {
    const [m, n, bases] = r.pick(EQ_POWERS.filter(([, n]) => n % 2 === 0));
    const b = r.pick(bases);
    const c = b ** m;
    return {
      prompt: md`Solve $x^{${m}/${n}} = ${-c}$. ${SOLS}`,
      accept: NO_SOLUTION,
      hint: md`The denominator ${n} is even. What sign does an even root have?`,
      solution: [
        { math: m === 1 ? md`x^{1/${n}} = ${root(n, "x")} \ge 0` : md`x^{${m}/${n}} = \left(${root(n, "x")}\right)^{${m}} \ge 0`, note: md`An even root needs $x \ge 0$ and is never negative, so neither is this power.` },
        { math: m === 1 ? md`x = (${-c})^{${n}} = ${c ** n}` : md`x^{${m}} = (${-c})^{${n}} = ${c ** n} \Rightarrow x = ${b ** n}`, note: md`If you raise both sides to the power ${n} anyway, you get a candidate.` },
        { math: md`${b ** n}^{${m}/${n}} = ${c} \ne ${-c}`, note: md`It fails the check: it solves $x^{${m}/${n}} = ${c}$ instead. **No solution.**` },
      ],
    };
  }
  if (kind === 3) {
    const [m, n, bases] = r.pick(EQ_POWERS.filter(([m, n]) => m > 1 || n < 4));
    const b = r.pick(bases);
    const c = b ** m;
    return {
      prompt: md`Solve $x^{-${m}/${n}} = \frac{1}{${c}}$. ${SOLS}`,
      answer: String(b ** n),
      form: "set",
      hint: "A negative exponent means reciprocal. Flip both sides first.",
      solution: [
        { math: md`x^{${m}/${n}} = ${c}`, note: md`Take reciprocals of both sides: $\frac{1}{x^{-r}} = x^r$.` },
        { math: md`x = ${c}^{${ex(n, m)}}`, note: md`Raise both sides to the reciprocal power $${ex(n, m)}$: $\left(x^{${m}/${n}}\right)^{${ex(n, m)}} = x^1$.` },
        m === 1 ? { math: md`x = ${c}^{${n}} = ${b ** n}`, note: "" } : { math: md`x = \left(${root(m, c)}\right)^{${n}} = ${b}^{${n}} = ${b ** n}`, note: md`Root first: $${root(m, c)} = ${b}$.` },
        { math: md`${b ** n}^{-${m}/${n}} = \frac{1}{${m === 1 ? root(n, b ** n) : md`\left(${root(n, b ** n)}\right)^{${m}}`}} = \frac{1}{${c}} \;\checkmark`, note: "Check." },
      ],
    };
  }
  if (kind === 4) {
    const b = r.int(1, 4);
    return {
      prompt: md`Solve $${root(3, "x^2")} = ${b * b}$. ${SOLS}`,
      answer: `${b ** 3}, ${-(b ** 3)}`,
      form: "set",
      hint: "Cube both sides to clear the root. Then solve the square.",
      solution: [
        { math: md`x^2 = ${b * b}^3 = ${b ** 6}`, note: "Cube both sides. Cubing is one-to-one, so this adds no solutions." },
        { math: md`x = \pm${root(2, b ** 6)} = \pm ${b ** 3}`, note: md`Two numbers square to ${b ** 6}.` },
        { math: md`${root(3, md`(${-(b ** 3)})^2`)} = ${root(3, b ** 6)} = ${b * b} \;\checkmark`, note: md`$x^2$ is never negative, so the negative answer is fine here. Both work.` },
      ],
    };
  }
  const [m, n, bases] = r.pick(EQ_POWERS);
  const b = r.pick(bases);
  const c = b ** m;
  const X = b ** n;
  const rootFirst: Step =
    m === 1
      ? { math: md`= ${X}`, note: "" }
      : { math: md`= \left(${root(m, c)}\right)^{${n}} = ${b}^{${n}} = ${X}`, note: md`Root first: $${root(m, c)} = ${b}$, since $${b}^${m} = ${c}$.` };
  if (kind === 0) {
    return {
      prompt: md`Solve $x^{${m}/${n}} = ${c}$. ${SOLS}`,
      answer: String(X),
      form: "set",
      hint: md`Raise both sides to the reciprocal power, $${ex(n, m)}$.`,
      solution: [
        { math: md`\left(x^{${m}/${n}}\right)^{${ex(n, m)}} = ${c}^{${ex(n, m)}}`, note: md`Raise both sides to the power $${ex(n, m)}$. On the left the exponents multiply to 1.` },
        { math: md`x = ${c}^{${ex(n, m)}}`, note: "" },
        rootFirst,
        { math: m === 1 ? md`${X}^{1/${n}} = ${root(n, X)} = ${b} \;\checkmark` : md`${X}^{${m}/${n}} = \left(${root(n, X)}\right)^{${m}} = ${b}^{${m}} = ${c} \;\checkmark`, note: md`Check. The steps above showed any solution has to equal ${X}, and it works, so it is the only one.` },
      ],
    };
  }
  const a = r.int(2, 3);
  const p = r.nonzero(-6, 6);
  const q = r.nonzero(-9, 9);
  const R = a * c + q;
  const inner = lin(1, p);
  return {
    prompt: md`Solve $${a}(${inner})^{${m}/${n}} ${signed(q)} = ${R}$. ${SOLS}`,
    answer: String(X - p),
    form: "set",
    hint: "Isolate the power first. Then raise both sides to the reciprocal power.",
    solution: [
      { math: md`${a}(${inner})^{${m}/${n}} = ${R - q}`, note: md`${q > 0 ? "Subtract" : "Add"} ${Math.abs(q)}.` },
      { math: md`(${inner})^{${m}/${n}} = ${c}`, note: md`Divide by ${a}.` },
      { math: md`${inner} = ${c}^{${ex(n, m)}}`, note: md`Raise both sides to the power $${ex(n, m)}$.` },
      rootFirst,
      { math: md`x = ${X - p}`, note: md`${p > 0 ? "Subtract" : "Add"} ${Math.abs(p)}. Check: $${a} \cdot ${c} ${signed(q)} = ${R} \;\checkmark$` },
    ],
  };
};

/** One candidate checked in √(radicand) = side. */
function checkRoot(v: number, radicand: number, side: number): Step {
  const root = Math.sqrt(radicand);
  if (root === side) return { math: md`x = ${v}: \quad \sqrt{${radicand}} = ${root} \;\checkmark`, note: md`The other side is ${side} too. It works.` };
  return { math: md`x = ${v}: \quad \sqrt{${radicand}} = ${root} \ne ${side}`, note: md`The root is ${root}, but the other side is ${side}. $x = ${v}$ is **extraneous**.` };
}

function radicalQuadratic(r: Rng): Problem {
  const want = r.pick(["one", "one", "one", "both", "none"] as const);
  for (;;) {
    // √(ax + b) = ex + c, built so that (ex + c)² - (ax + b) = (x - s)(x - t).
    const e = want === "none" ? -1 : r.next() < 0.7 ? 1 : -1;
    const c = e === 1 ? r.int(-4, 3) : r.int(1, 8);
    const s = r.int(-5, 9);
    const t = r.int(-5, 9);
    if (s >= t) continue;
    const a = s + t + 2 * e * c;
    const b = c * c - s * t;
    if (a < 1 || a > 12 || Math.abs(b) > 30) continue;
    const side = (v: number) => e * v + c;
    const good = [s, t].filter((v) => side(v) >= 0);
    if ((want === "one" && good.length !== 1) || (want === "both" && good.length !== 2) || (want === "none" && good.length !== 0)) continue;
    const inside = lin(a, b);
    const right = e === 1 ? lin(1, c) : poly([[c, ""], [-1, "x"]]);
    const asPower = r.next() < 0.35;
    const lhs = asPower ? md`(${inside})^{1/2}` : md`\sqrt{${inside}}`;
    const quad = poly([[1, "x^2"], [-(s + t), "x"], [s * t, ""]]);
    const fac = (v: number) => (v === 0 ? "x" : `(${lin(1, -v)})`);
    const steps: Step[] = [];
    if (asPower) steps.push({ math: md`\sqrt{${inside}} = ${right}`, note: md`An exponent of $1/2$ is a square root.` });
    steps.push(
      { math: md`${inside} = ${c === 0 ? "x^2" : md`(${right})^2`}`, note: "Square both sides. This can add candidates, so every one gets checked." },
      ...(c === 0 ? [] : [{ math: md`${inside} = ${poly([[1, "x^2"], [2 * e * c, "x"], [c * c, ""]])}`, note: "Expand the right side." }]),
      { math: md`0 = ${quad} = ${s === 0 || t === 0 ? (s === 0 ? `x${fac(t)}` : `x${fac(s)}`) : `${fac(s)}${fac(t)}`}`, note: md`Collect on one side and factor. The candidates are $${s}$ and $${t}$.` },
      checkRoot(s, a * s + b, side(s)),
      checkRoot(t, a * t + b, side(t)),
    );
    if (!good.length) steps.push({ math: md`\text{no solution}`, note: "Both candidates came from squaring, not from the original equation." });
    return {
      prompt: md`Solve $${lhs} = ${right}$. ${SOLS}`,
      ...(good.length ? { answer: good.join(", "), form: "set" as const } : { accept: NO_SOLUTION }),
      hint: "Square both sides, solve the quadratic, then check every candidate in the original equation.",
      solution: steps,
    };
  }
}

const radicalEquations: Generator = (r): Problem => {
  const kind = r.pick([0, 0, 0, 1, 1, 2, 2, 3]);
  if (kind === 0) return radicalQuadratic(r);
  if (kind === 1) {
    for (;;) {
      const a = r.int(1, 4);
      const x = r.int(-8, 10);
      const t = r.nonzero(-4, 4);
      const b = t ** 3 - a * x;
      const d = r.int(-9, 9);
      if (b === 0 || Math.abs(b) > 40) continue;
      const inside = lin(a, b);
      const steps: Step[] = [];
      if (d) steps.push({ math: md`${root(3, inside)} = ${t}`, note: md`Isolate the root: ${d > 0 ? "subtract" : "add"} ${Math.abs(d)}.` });
      steps.push(
        { math: md`${inside} = ${paren(t)}^3 = ${t ** 3}`, note: "Cube both sides. Cubing is one-to-one, so no extraneous solutions can appear." },
        ...(a === 1 ? [] : [{ math: md`${a}x = ${t ** 3 - b}`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)}.` }]),
        { math: md`x = ${x}`, note: a === 1 ? md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)}.` : md`Divide by ${a}.` },
        { math: md`${root(3, t ** 3)}${plusK(d)} = ${t + d} \;\checkmark`, note: "A check is still a good habit." },
      );
      return {
        prompt: md`Solve $${root(3, inside)}${plusK(d)} = ${t + d}$. ${SOLS}`,
        answer: String(x),
        form: "set",
        ...(t < 0 ? { verify: [`${inside} = (${t})^3`] } : {}),
        hint: "Isolate the cube root, then cube both sides.",
        solution: steps,
      };
    }
  }
  if (kind === 2) {
    for (;;) {
      const d = r.int(1, 3);
      const s = r.int(1, 6);
      const k = 2 * d * s + d * d;
      if (k > 45) continue;
      return {
        prompt: md`Solve $\sqrt{x + ${k}} = \sqrt{x} + ${d}$. ${SOLS}`,
        answer: String(s * s),
        form: "set",
        hint: md`Square both sides. The right side is a binomial: $(\sqrt{x} + ${d})^2$ has a middle term.`,
        solution: [
          { math: md`x + ${k} = x + ${2 * d}\sqrt{x} + ${d * d}`, note: md`Square both sides. $(\sqrt{x} + ${d})^2 = x + ${2 * d}\sqrt{x} + ${d * d}$, by $(p + q)^2 = p^2 + 2pq + q^2$.` },
          { math: md`${k - d * d} = ${2 * d}\sqrt{x}`, note: md`The $x$ terms cancel. Subtract ${d * d}.` },
          { math: md`\sqrt{x} = ${s}`, note: md`Divide by ${2 * d}. The root is alone now.` },
          { math: md`x = ${s * s}`, note: "Square again." },
          { math: md`\sqrt{${s * s + k}} = ${s + d} = \sqrt{${s * s}} + ${d} \;\checkmark`, note: "Check in the original equation: it works." },
        ],
      };
    }
  }
  const c = r.int(1, 3) * (r.next() < 0.25 ? -1 : 1);
  const a = r.int(1, 3);
  let x = r.int(-5, 10);
  while (c ** 4 - a * x === 0) x = r.int(-5, 10);
  const b = c ** 4 - a * x;
  const inside = lin(a, b);
  if (c < 0) {
    return {
      prompt: md`Solve $${root(4, inside)} = ${c}$. ${SOLS}`,
      accept: NO_SOLUTION,
      hint: "Is a principal fourth root ever negative?",
      solution: [
        { math: md`${root(4, inside)} \ge 0`, note: "An even root is never negative." },
        { math: md`${inside} = ${c ** 4} \Rightarrow x = ${x}`, note: md`Raising both sides to the 4th power anyway gives a candidate.` },
        { math: md`${root(4, c ** 4)} = ${-c} \ne ${c}`, note: md`It fails: it solves $${root(4, inside)} = ${-c}$. **No solution.**` },
      ],
    };
  }
  return {
    prompt: md`Solve $${root(4, inside)} = ${c}$. ${SOLS}`,
    answer: String(x),
    form: "set",
    hint: "Raise both sides to the 4th power.",
    solution: [
      { math: md`${inside} = ${c}^4 = ${c ** 4}`, note: "Raise both sides to the 4th power." },
      ...(a === 1 ? [] : [{ math: md`${a}x = ${c ** 4 - b}`, note: md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)}.` }]),
      { math: md`x = ${x}`, note: a === 1 ? md`${b > 0 ? "Subtract" : "Add"} ${Math.abs(b)}.` : md`Divide by ${a}.` },
      { math: md`${root(4, c ** 4)} = ${c} \;\checkmark`, note: "Check: the radicand is positive and the root matches." },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

/** A cube of side s drawn in oblique projection, for the cube-root picture. */
const cubeDiagram = {
  view: [-1, 8, -1, 7.5] as [number, number, number, number],
  points: [
    { name: "A", x: 0, y: 0, hidden: true, label: "" },
    { name: "B", x: "s", y: 0, hidden: true, label: "" },
    { name: "C", x: "s", y: "s", hidden: true, label: "" },
    { name: "D", x: 0, y: "s", hidden: true, label: "" },
    { name: "E", x: "0.45s", y: "0.35s", hidden: true, label: "" },
    { name: "F", x: "1.45s", y: "0.35s", hidden: true, label: "" },
    { name: "G", x: "1.45s", y: "1.35s", hidden: true, label: "" },
    { name: "H", x: "0.45s", y: "1.35s", hidden: true, label: "" },
  ],
  polygons: [
    { points: ["A", "B", "C", "D"], fill: 1 as const },
    { points: ["D", "C", "G", "H"], fill: 3 as const },
    { points: ["B", "F", "G", "C"], fill: 2 as const },
  ],
  segments: [
    { from: "A", to: "B", label: md`s = {s}` },
    { from: "A", to: "E", dashed: true },
    { from: "E", to: "F", dashed: true },
    { from: "E", to: "H", dashed: true },
  ],
  params: [{ name: "s", min: 1, max: 5, step: 0.5, value: 2 }],
  readouts: [{ label: "V = s^3", value: "s^3" }],
  caption: md`Drag $s$. The volume is $s^3$. When the volume reads 64, the side is $4$: the cube root of 64.`,
};

export const unit5: Unit = {
  title: "Radicals and Rational Exponents",
  lessons: [
    {
      id: "nth-roots",
      title: "Nth roots",
      summary: "Cube roots, fourth roots and beyond: what they mean, why odd and even roots behave differently, and how to simplify them.",
      blocks: [
        {
          kind: "text",
          body: md`In Algebra 1, Unit 9, $\sqrt{a}$ answered one question: which number squared gives $a$? Nothing stops us asking the same question about other powers. Which number cubed gives 64? Which number to the fourth power gives 81?

The first one has a picture. A cube with volume 64 has a side $s$ with $s^3 = 64$. Since $4 \cdot 4 \cdot 4 = 64$, the side is 4. That number is the **cube root** of 64.`,
        },
        { kind: "diagram", ...cubeDiagram },
        {
          kind: "key",
          title: "nth root",
          body: md`Let $n \ge 2$ be a whole number. A number $b$ is an **$n$th root** of $a$ when $b^n = a$.

The **principal $n$th root**, written $\sqrt[n]{a}$, is:

- for **odd** $n$: the one real number whose $n$th power is $a$;
- for **even** $n$ and $a \ge 0$: the nonnegative one.

For even $n$ and $a < 0$, $\sqrt[n]{a}$ is not a real number. The number $n$ is the **index**. A plain $\sqrt{a}$ is the index-2 case.`,
        },
        {
          kind: "why",
          title: "Why odd and even roots behave differently",
          body: md`It all comes from the sign rules. Multiply $n$ negative numbers and the signs pair off. If $n$ is even they all pair up and the product is positive. If $n$ is odd, one sign is left over and the product is negative.

- **Even powers hide the sign:** $3^4 = 81$ and $(-3)^4 = 81$. Two real numbers have fourth power 81, and none has fourth power $-81$.
- **Odd powers keep the sign:** $3^3 = 27$ but $(-3)^3 = -27$. Bigger inputs always give bigger cubes, so no number is the cube of two different reals. And the cubes run without a break from very negative to very positive (slide the line below), so every number is reached: each number is the cube of exactly one real number.

For odd $n$ there is nothing to choose. For even $n$ there are two candidates, and just as with $\sqrt{\phantom{a}}$, we take the nonnegative one, so that $\sqrt[n]{a}$ is a function: one input, one output.`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-9, 9],
          curves: [
            { expr: "x^3", label: "y = x^3", color: 1 },
            { expr: "x^4", label: "y = x^4", color: 2 },
            { expr: "c", label: "y = c", color: 3, dashed: true },
          ],
          params: [{ name: "c", min: -8, max: 8, step: 1, value: 5 }],
          caption: md`Slide the line $y = c$. It always meets the cube curve exactly once: every number has one real cube root. It meets $y = x^4$ twice when $c > 0$, once when $c = 0$, and never when $c < 0$.`,
        },
        {
          kind: "key",
          title: "Odd and even roots",
          body: md`- **Odd index:** $\sqrt[n]{a}$ is real for every $a$, and $\sqrt[n]{-a} = -\sqrt[n]{a}$. For example $\sqrt[3]{-8} = -2$.
- **Even index:** $\sqrt[n]{a}$ is real only when $a \ge 0$, and then it is never negative.

**Typing roots.** There is no cube-root key. Type $\sqrt[3]{5}$ as **5^(1/3)**, and in general $\sqrt[n]{a}$ as **a^(1/n)**. For a negative number under an odd root, pull the sign out first: type $\sqrt[3]{-5}$ as **-5^(1/3)**. The next lesson shows why this notation is exactly right, and why the minus goes outside.`,
        },
        {
          kind: "why",
          title: "Why the sign comes out of an odd root",
          body: md`Cube $-\sqrt[3]{a}$, using the power of a product (Algebra 1, Unit 6):
$$\left(-\sqrt[3]{a}\right)^3 = (-1)^3\left(\sqrt[3]{a}\right)^3 = -a.$$
So $-\sqrt[3]{a}$ is a real number whose cube is $-a$. There is only one such number, and its name is $\sqrt[3]{-a}$. The same works for any odd $n$, because $(-1)^n = -1$ when $n$ is odd. For even $n$ the argument breaks: $(-1)^n = 1$.`,
        },
        {
          kind: "example",
          title: "Evaluating roots",
          problem: md`Evaluate $\sqrt[3]{-125}$, $\sqrt[4]{81}$, $\sqrt[5]{\frac{1}{32}}$, $\sqrt[4]{-16}$ and $-\sqrt[4]{16}$.`,
          steps: [
            { math: md`\sqrt[3]{-125} = -\sqrt[3]{125} = -5`, note: md`Odd index: pull the sign out. $5^3 = 125$.` },
            { math: md`\sqrt[4]{81} = 3`, note: md`$3^4 = 81$. $-3$ is also a fourth root of 81, but the principal root is the nonnegative one.` },
            { math: md`\sqrt[5]{\tfrac{1}{32}} = \tfrac{1}{2}`, note: md`$\left(\frac{1}{2}\right)^5 = \frac{1}{32}$.` },
            { math: md`\sqrt[4]{-16} \text{ is not real}`, note: "Even index, negative radicand: no real number has a negative fourth power." },
            { math: md`-\sqrt[4]{16} = -2`, note: "Here the minus is outside the root. Take the root, then the opposite." },
          ],
        },
        {
          kind: "check",
          prompt: md`Evaluate $\sqrt[3]{-64}$.`,
          answer: "-4",
          explain: md`$(-4)^3 = -64$, and an odd root keeps the sign: $\sqrt[3]{-64} = -\sqrt[3]{64} = -4$.`,
        },
        {
          kind: "proof",
          title: "The product rule for nth roots",
          given: md`Real numbers $a$ and $b$, with $a, b \ge 0$ when $n$ is even`,
          prove: md`$\sqrt[n]{ab} = \sqrt[n]{a}\cdot\sqrt[n]{b}$`,
          steps: [
            { statement: md`Let $p = \sqrt[n]{a}\cdot\sqrt[n]{b}$.`, reason: "A name for the right side" },
            { statement: md`$p^n = \left(\sqrt[n]{a}\right)^n\left(\sqrt[n]{b}\right)^n$`, reason: md`Power of a product, $(xy)^n = x^n y^n$` },
            { statement: md`$p^n = ab$`, reason: md`Definition of an $n$th root: $\left(\sqrt[n]{a}\right)^n = a$` },
            { statement: md`If $n$ is even, $p \ge 0$`, reason: "Both factors are principal even roots, and neither is negative" },
            { statement: md`$p = \sqrt[n]{ab}$`, reason: md`$p$ is an $n$th root of $ab$, and nonnegative when $n$ is even, so it is the principal one. For odd $n$ there is only one real $n$th root anyway.` },
          ],
        },
        {
          kind: "key",
          title: "Simplifying an nth root",
          body: md`Write the radicand as (the largest perfect $n$th power that divides it) $\times$ (the rest), then split it with the product rule. The root is simplified when the radicand has no perfect $n$th-power factor other than 1.

- Perfect cubes: $8, 27, 64, 125, 216$
- Perfect fourth powers: $16, 81, 256, 625$`,
        },
        {
          kind: "example",
          title: "Pulling out perfect powers",
          problem: md`Simplify $\sqrt[3]{54}$, $\sqrt[4]{48}$ and $\sqrt[3]{-250}$.`,
          steps: [
            { math: md`\sqrt[3]{54} = \sqrt[3]{27 \cdot 2} = \sqrt[3]{27}\cdot\sqrt[3]{2} = 3\sqrt[3]{2}`, note: "27 is the largest perfect cube that divides 54." },
            { math: md`\sqrt[4]{48} = \sqrt[4]{16 \cdot 3} = 2\sqrt[4]{3}`, note: md`$16 = 2^4$. The factor 4 in 48 is a perfect square but not a perfect fourth power, so it can't come out of a fourth root.` },
            { math: md`\sqrt[3]{-250} = -\sqrt[3]{125 \cdot 2} = -5\sqrt[3]{2}`, note: "Sign out first, then the perfect cube." },
          ],
        },
        {
          kind: "why",
          title: "Why the nth root of xⁿ is x, or |x|",
          body: md`For odd $n$, $x^n$ has the same sign as $x$, and the only real $n$th root of $x^n$ is $x$ itself: $\sqrt[3]{(-2)^3} = \sqrt[3]{-8} = -2$.

For even $n$, the root has to be nonnegative: $\sqrt[4]{(-2)^4} = \sqrt[4]{16} = 2 = |-2|$. So
$$\sqrt[n]{x^n} = x \text{ for odd } n, \qquad \sqrt[n]{x^n} = |x| \text{ for even } n.$$
You met the $n = 2$ case in Algebra 1 as $\sqrt{x^2} = |x|$. The same idea pulls powers of variables out of a cube root: $\sqrt[3]{x^7} = \sqrt[3]{x^6}\cdot\sqrt[3]{x} = x^2\sqrt[3]{x}$, since $(x^2)^3 = x^6$.`,
        },
        {
          kind: "check",
          prompt: md`Write $\sqrt[3]{40}$ in the form $a\sqrt[3]{b}$, where $b$ has no perfect-cube factor other than 1. Give $(a, b)$.`,
          answer: "(2, 5)",
          form: "tuple",
          explain: md`$40 = 8 \cdot 5$ and $8 = 2^3$, so $\sqrt[3]{40} = \sqrt[3]{8}\cdot\sqrt[3]{5} = 2\sqrt[3]{5}$.`,
        },
      ],
      practice: [evalRoot, simplifyNthRoot, solvePower],
    },
    {
      id: "rational-exponents",
      title: "Rational exponents",
      summary: "What a fractional exponent has to mean if the exponent rules keep working, and how to compute and simplify with one.",
      blocks: [
        {
          kind: "text",
          body: md`Algebra 1, Unit 6 built exponents in stages. First $x^n$ for whole numbers $n$, as repeated multiplication. Then $x^0$ and $x^{-n}$, which can't mean repeated multiplication. We chose their meanings so that the exponent rules kept working.

Now take the next step. What could $9^{1/2}$ or $8^{2/3}$ mean? You can't multiply 8 by itself two-thirds of a time. But we can ask the rules what the answer has to be.`,
        },
        {
          kind: "why",
          title: "What a^(1/n) has to be",
          body: md`Suppose the power-of-a-power rule, $(a^r)^s = a^{rs}$, keeps working when $r$ is a fraction. Then
$$\left(9^{1/2}\right)^2 = 9^{\frac{1}{2}\cdot 2} = 9^1 = 9.$$
So $9^{1/2}$ is a number whose square is 9: it has to be 3 or $-3$. The product rule says the same thing another way: $9^{1/2}\cdot 9^{1/2} = 9^{1/2 + 1/2} = 9^1$.

In general $\left(a^{1/n}\right)^n = a$, so $a^{1/n}$ must be an $n$th root of $a$. Which one? The rules settle that too: $9^{1/2} = 9^{\frac{1}{4}\cdot 2} = \left(9^{1/4}\right)^2$ is a square, so it can't be negative. The same goes for any $a^{1/n} = \left(a^{1/(2n)}\right)^2$, so $a^{1/n}$ has to be the principal root. And the same rule settles every fraction: $a^{m/n} = a^{\frac{1}{n}\cdot m} = \left(a^{1/n}\right)^m$. There was no real freedom here. Any other meaning would break a rule we already rely on.`,
        },
        {
          kind: "key",
          title: "Rational exponents",
          body: md`For $a > 0$ and whole numbers $m \ge 1$, $n \ge 2$:
$$a^{1/n} = \sqrt[n]{a} \qquad a^{m/n} = \left(\sqrt[n]{a}\right)^m = \sqrt[n]{a^m} \qquad a^{-m/n} = \frac{1}{a^{m/n}}$$
The **denominator is the root** and the **numerator is the power**. For example $8^{2/3} = \left(\sqrt[3]{8}\right)^2 = 4$.`,
        },
        {
          kind: "proof",
          title: "Root then power equals power then root",
          given: md`$a > 0$, and whole numbers $m \ge 1$, $n \ge 2$`,
          prove: md`$\left(\sqrt[n]{a}\right)^m = \sqrt[n]{a^m}$`,
          steps: [
            { statement: md`Let $b = \sqrt[n]{a}$. Then $b > 0$ and $b^n = a$.`, reason: md`Definition of the principal $n$th root, with $a > 0$` },
            { statement: md`$\left(b^m\right)^n = b^{mn} = \left(b^n\right)^m$`, reason: "Power of a power, both ways round (whole-number exponents)" },
            { statement: md`$\left(b^m\right)^n = a^m$`, reason: md`Substitute $b^n = a$` },
            { statement: md`$b^m > 0$`, reason: "A product of positive numbers is positive" },
            { statement: md`$b^m = \sqrt[n]{a^m}$`, reason: md`$b^m$ is a positive number whose $n$th power is $a^m$, and there is only one such number` },
          ],
        },
        {
          kind: "example",
          title: "Root first keeps the numbers small",
          problem: md`Evaluate $8^{2/3}$, $16^{-3/4}$ and $\left(\frac{4}{9}\right)^{3/2}$.`,
          steps: [
            { math: md`8^{2/3} = \left(\sqrt[3]{8}\right)^2 = 2^2 = 4`, note: md`Root first: $\sqrt[3]{8} = 2$.` },
            { math: md`8^{2/3} = \sqrt[3]{8^2} = \sqrt[3]{64} = 4`, note: "Power first gives the same answer, as the proof promised, but with bigger numbers." },
            { math: md`16^{-3/4} = \frac{1}{16^{3/4}} = \frac{1}{\left(\sqrt[4]{16}\right)^3} = \frac{1}{2^3} = \frac{1}{8}`, note: "A negative exponent means reciprocal. It never makes the answer negative." },
            { math: md`\left(\tfrac{4}{9}\right)^{3/2} = \left(\tfrac{2}{3}\right)^3 = \tfrac{8}{27}`, note: "Power of a quotient: take the square root of the top and of the bottom, then cube." },
          ],
        },
        {
          kind: "check",
          prompt: md`Evaluate $32^{3/5}$.`,
          answer: "8",
          explain: md`$\sqrt[5]{32} = 2$, since $2^5 = 32$. Then $2^3 = 8$.`,
        },
        {
          kind: "key",
          title: "The exponent rules, for rational exponents",
          body: md`For $a, b > 0$ and any rational numbers $r$ and $s$:

- **Product:** $a^r a^s = a^{r + s}$
- **Quotient:** $\frac{a^r}{a^s} = a^{r - s}$
- **Power of a power:** $(a^r)^s = a^{rs}$
- **Power of a product:** $(ab)^r = a^r b^r$`,
        },
        {
          kind: "why",
          title: "Why the rules still hold",
          body: md`Take $a^{1/2}\cdot a^{1/3}$. Is it really $a^{5/6}$? Check it using only whole-number rules. Raise the left side to the 6th power:
$$\left(a^{1/2}a^{1/3}\right)^6 = \left(a^{1/2}\right)^6\left(a^{1/3}\right)^6 = \left(\left(a^{1/2}\right)^2\right)^3\left(\left(a^{1/3}\right)^3\right)^2 = a^3 \cdot a^2 = a^5.$$
So the left side is a positive number whose 6th power is $a^5$. That is exactly what $a^{5/6} = \sqrt[6]{a^5}$ means.

The same trick proves every rule in the list: raise both sides to a common denominator. That turns a question about fractions into one about whole numbers, where the rules are already proved.`,
        },
        {
          kind: "example",
          title: "Simplifying with the rules",
          problem: md`Simplify, for $x > 0$, $x^{2/3}\cdot x^{1/4}$, $\frac{x^{3/2}}{x^{1/3}}$, $\left(x^{3/4}\right)^{2/3}$ and $\sqrt[3]{x}\cdot\sqrt{x}$.`,
          steps: [
            { math: md`x^{2/3}\cdot x^{1/4} = x^{8/12 + 3/12} = x^{11/12}`, note: "Product rule: add the exponents over a common denominator." },
            { math: md`\frac{x^{3/2}}{x^{1/3}} = x^{9/6 - 2/6} = x^{7/6}`, note: "Quotient rule: subtract." },
            { math: md`\left(x^{3/4}\right)^{2/3} = x^{6/12} = x^{1/2}`, note: "Power of a power: multiply, then reduce." },
            { math: md`\sqrt[3]{x}\cdot\sqrt{x} = x^{1/3}x^{1/2} = x^{5/6}`, note: "Roots with different indexes can't be combined as roots. Rewritten as powers of the same base, they can." },
          ],
        },
        {
          kind: "why",
          title: "Why the base must be positive",
          body: md`It's tempting to say $(-8)^{1/3} = \sqrt[3]{-8} = -2$. But watch the rules. Since $\frac{1}{3} = \frac{2}{6}$, they would also give
$$(-8)^{1/3} = (-8)^{2/6} = \sqrt[6]{(-8)^2} = \sqrt[6]{64} = 2.$$
One expression with two values, $-2$ and $2$, is no good. Something has to give, and the usual choice (this course's too) is to use rational exponents only with positive bases, where every rule is safe.

Odd roots of negative numbers are still fine. Write them as roots and pull the sign out: $\sqrt[3]{-8} = -\sqrt[3]{8} = -2$. That's why you type it as **-8^(1/3)**: the exponent applies to the 8 first, then the minus, just as $-3^2 = -9$.`,
        },
        {
          kind: "plot",
          x: [-0.5, 4],
          y: [-0.5, 4],
          curves: [
            { expr: "x", label: "y = x", color: 3, dashed: true, domain: [0, 4] },
            { expr: "x^2", label: "y = x^2", color: 2, dashed: true, domain: [0, 4] },
            { expr: "x^p", label: "y = x^{{p}}", color: 1, domain: [0, 4] },
          ],
          points: [{ x: 1, y: 1, label: "(1, 1)" }],
          params: [{ name: "p", min: 0.1, max: 3, step: 0.05, value: 1.5 }],
          caption: md`Every power curve passes through $(1, 1)$, because $1^p = 1$. Exponents between 1 and 2, like $x^{3/2}$, sit between the line and the parabola. Below $p = 1$ the curve bends the other way: $p = 0.5$ is $\sqrt{x}$.`,
        },
        {
          kind: "check",
          prompt: md`Simplify $x^{1/4}\cdot x^{1/2}$. Write it as a single power of $x$, like x^(a/b).`,
          answer: "x^(3/4)",
          simplified: true,
          explain: md`Add the exponents: $\frac{1}{4} + \frac{2}{4} = \frac{3}{4}$.`,
        },
      ],
      practice: [evalRational, simplifyPowers, rootsToPowers],
    },
    {
      id: "radical-functions",
      title: "Radical functions",
      summary: "Square-root and cube-root graphs, their domains and transformations, and equations with roots and rational exponents.",
      blocks: [
        {
          kind: "text",
          body: md`A **radical function** has its variable under a root, like $f(x) = \sqrt{x}$ or $g(x) = \sqrt[3]{x - 2}$. Everything from Unit 1 applies: domain and range, inverses, transformations. The roots just give each idea a particular shape.`,
        },
        {
          kind: "plot",
          x: [-9, 9],
          y: [-3.5, 3.5],
          curves: [
            { expr: "sqrt(x)", label: md`y = \sqrt{x}`, color: 1, domain: [0, 9] },
            { expr: "x^(1/3)", label: md`y = \sqrt[3]{x}`, color: 2, domain: [0, 9] },
            { expr: "-(-x)^(1/3)", color: 2, domain: [-9, 0] },
          ],
          points: [
            { x: 4, y: 2, label: "(4, 2)", color: 1 },
            { x: 8, y: 2, label: "(8, 2)", color: 2 },
            { x: -8, y: -2, label: "(-8, -2)", color: 2 },
            { x: 0, y: 0 },
          ],
          caption: md`$\sqrt{x}$ starts at the origin and only exists to the right. $\sqrt[3]{x}$ runs through the origin in both directions, because negative numbers have cube roots too.`,
        },
        {
          kind: "key",
          title: "Domain of a radical function",
          body: md`- **Even index:** the radicand must be $\ge 0$. Solve that inequality to get the domain.
- **Odd index:** every real number works.

So $f(x) = \sqrt{x}$ has domain and range $[0, \infty)$, while $g(x) = \sqrt[3]{x}$ has domain and range $(-\infty, \infty)$.`,
        },
        {
          kind: "why",
          title: "Why the graphs have these shapes",
          body: md`$\sqrt{x}$ undoes squaring, so it is the **inverse** of $y = x^2$, restricted to $x \ge 0$ so that it is one-to-one (Unit 1). Its graph is that half-parabola reflected over $y = x$: swapping coordinates turns $(2, 4)$ into $(4, 2)$.

$\sqrt[3]{x}$ is the inverse of $y = x^3$, which is already one-to-one, so no restriction is needed. Reflecting the cubic over $y = x$ turns its flat spot at the origin into a vertical one. Near 0 the cube root climbs steeply: $\sqrt[3]{0.001} = 0.1$, a hundred times bigger than the input.`,
        },
        {
          kind: "example",
          title: "Finding a domain",
          problem: md`Find the domains of $f(x) = \sqrt{6 - 2x} + 1$ and $g(x) = \sqrt[3]{6 - 2x}$.`,
          steps: [
            { math: md`6 - 2x \ge 0`, note: md`$f$ has an even index, so its radicand can't be negative.` },
            { math: md`-2x \ge -6 \;\Rightarrow\; x \le 3`, note: "Subtract 6, then divide by -2. Dividing by a negative flips the inequality (Algebra 1, Unit 3)." },
            { math: md`\text{domain of } f = (-\infty, 3]`, note: md`The $+1$ outside the root has no effect on which inputs are allowed.` },
            { math: md`\text{domain of } g = (-\infty, \infty)`, note: "An odd root accepts any radicand, so every x works." },
          ],
        },
        {
          kind: "plot",
          x: [-6, 8],
          y: [-6, 6],
          curves: [
            { expr: "sqrt(x)", label: md`y = \sqrt{x}`, color: 3, dashed: true, domain: [0, 8] },
            { expr: "a sqrt(x - h) + k", label: md`y = a\sqrt{x - h} + k`, color: 1 },
          ],
          points: [{ x: "h", y: "k", label: md`(h, k) = ({h}, {k})`, color: 2 }],
          params: [
            { name: "a", min: -3, max: 3, step: 0.5, value: 1 },
            { name: "h", min: -4, max: 4, step: 1, value: 1 },
            { name: "k", min: -4, max: 4, step: 1, value: -2 },
          ],
          caption: md`The orange dot is the starting point. Move $h$ and $k$ and the whole graph slides with it. A negative $a$ flips the graph downward, so the range changes direction.`,
        },
        {
          kind: "why",
          title: "Why the graph starts at (h, k)",
          body: md`The radicand $x - h$ is 0 exactly when $x = h$. So the graph starts there, at height $a\sqrt{0} + k = k$. Any $x$ to the left makes the radicand negative, and the root doesn't exist.

This is the shift rule from Unit 1, seen from inside: the input has to be $h$ bigger to give the root the same thing to work on, so everything happens $h$ units to the right. Then $a$ stretches the heights (and flips them if it is negative), and $k$ lifts every point by $k$.`,
        },
        {
          kind: "key",
          title: "Transformed radical graphs",
          body: md`For $y = a\sqrt{x - h} + k$:

- the graph starts at $(h, k)$;
- the domain is $x \ge h$;
- the range is $y \ge k$ when $a > 0$, and $y \le k$ when $a < 0$.

For $y = a\sqrt[3]{x - h} + k$, the steep center point is $(h, k)$, and the domain and range are both all real numbers.`,
        },
        {
          kind: "check",
          prompt: md`Find the range of $f(x) = -2\sqrt{x + 1} + 3$. ${RANGE_NOTE}`,
          answer: "y <= 3",
          form: "inequality",
          explain: md`The root starts at 0 and goes up. Multiplying by $-2$ makes those values 0 or less, and adding 3 gives $y \le 3$, or $(-\infty, 3]$. The graph starts at $(-1, 3)$ and heads down.`,
        },
        {
          kind: "plot",
          x: [-8, 8],
          y: [-6, 6],
          curves: [
            { expr: "a (x - h)^(1/3) + k", label: md`y = a\sqrt[3]{x - h} + k`, color: 1 },
            { expr: "k - a (h - x)^(1/3)", color: 1 },
          ],
          points: [{ x: "h", y: "k", label: md`(h, k) = ({h}, {k})`, color: 2 }],
          params: [
            { name: "a", min: -3, max: 3, step: 0.5, value: 1 },
            { name: "h", min: -4, max: 4, step: 1, value: 2 },
            { name: "k", min: -4, max: 4, step: 1, value: 1 },
          ],
          caption: md`The cube root has no endpoint. The steep point sits at $(h, k)$, and the graph keeps going both ways, so every height is reached.`,
        },
        {
          kind: "example",
          title: "Undoing a rational exponent",
          problem: md`Solve $2x^{3/2} - 5 = 11$.`,
          steps: [
            { math: md`2x^{3/2} = 16 \;\Rightarrow\; x^{3/2} = 8`, note: "Isolate the power, exactly as in Algebra 1, Unit 9." },
            { math: md`\left(x^{3/2}\right)^{2/3} = 8^{2/3}`, note: md`Raise both sides to the reciprocal power. On the left, $\frac{3}{2}\cdot\frac{2}{3} = 1$.` },
            { math: md`x = \left(\sqrt[3]{8}\right)^2 = 4`, note: "Root first." },
            { math: md`2 \cdot 4^{3/2} - 5 = 2 \cdot 8 - 5 = 11 \;\checkmark`, note: "Check in the original equation." },
          ],
        },
        {
          kind: "proof",
          title: "Cubing both sides never adds solutions",
          given: md`Real numbers $A$ and $B$ with $A^3 = B^3$`,
          prove: md`$A = B$`,
          steps: [
            { statement: md`$A^3 - B^3 = 0$`, reason: md`Subtract $B^3$` },
            { statement: md`$(A - B)(A^2 + AB + B^2) = 0$`, reason: md`Multiply out to check: $A^3 + A^2B + AB^2 - A^2B - AB^2 - B^3 = A^3 - B^3$` },
            { statement: md`$A^2 + AB + B^2 = \left(A + \tfrac{B}{2}\right)^2 + \tfrac{3}{4}B^2$`, reason: "Completing the square (Algebra 1, Unit 8)" },
            { statement: md`$A^2 + AB + B^2 = 0$ only when $A = B = 0$`, reason: md`A sum of squares is 0 only when each square is 0: $B = 0$, and then $A = 0$` },
            { statement: md`$A - B = 0$ either way`, reason: "Zero product property: if the second factor isn't 0, the first one is; if it is, A = B = 0" },
            { statement: md`$A = B$`, reason: "Add B" },
          ],
        },
        {
          kind: "text",
          body: md`Squaring is different: $A^2 = B^2$ only tells you $A = \pm B$. That is where extraneous solutions come from (Algebra 1, Unit 9). So after cubing, a check is good practice. After squaring, or raising to any even power, a check is **required**.

Here is an even power at work. Solve $x^{3/2} = -8$. Squaring gives $x^3 = 64$, so $x = 4$. But $4^{3/2} = \left(\sqrt{4}\right)^3 = 8$, not $-8$. The candidate is extraneous: $x^{3/2}$ involves a square root, so it is never negative, and there is **no solution**.`,
        },
        {
          kind: "example",
          title: "Two square roots",
          problem: md`Solve $\sqrt{x + 7} = \sqrt{x} + 1$.`,
          steps: [
            { math: md`x + 7 = x + 2\sqrt{x} + 1`, note: md`Square both sides. The right side is a binomial: $(\sqrt{x} + 1)^2 = x + 2\sqrt{x} + 1$.` },
            { math: md`6 = 2\sqrt{x} \;\Rightarrow\; \sqrt{x} = 3`, note: md`The $x$ terms cancel, leaving one root, now isolated.` },
            { math: md`x = 9`, note: "Square again." },
            { math: md`\sqrt{16} = 4 = \sqrt{9} + 1 \;\checkmark`, note: "Check: it works." },
          ],
        },
        {
          kind: "check",
          prompt: md`Solve $\sqrt[3]{x - 4} = -2$. Give all real solutions, separated by commas.`,
          answer: "-4",
          form: "set",
          explain: md`Cube both sides: $x - 4 = -8$, so $x = -4$. Check: $\sqrt[3]{-8} = -2 \;\checkmark$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $\sqrt{x + 7} = x + 1$. Give all real solutions, separated by commas.`,
          answer: "2",
          form: "set",
          explain: md`Square: $x + 7 = x^2 + 2x + 1$, so $x^2 + x - 6 = (x + 3)(x - 2) = 0$. Check $x = 2$: $\sqrt{9} = 3 \;\checkmark$. Check $x = -3$: $\sqrt{4} = 2 \ne -2$, extraneous. The only solution is 2.`,
        },
      ],
      practice: [radicalFeatures, rationalEquations, radicalEquations],
    },
  ],
};
