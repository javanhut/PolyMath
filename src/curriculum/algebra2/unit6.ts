import { frac, fracTex, paren, poly, signed } from "../../math/random";
import { md, type Figure, type Generator, type Step, type Unit } from "../types";

// ── Shared wording and helpers ──────────────────────────────────────────────

const EXACT_LOG = "Give an exact answer. Type logarithms like log_6(5), log(5) or ln(5); any equal form is accepted.";
const ROUND3 = "Round to 3 decimal places.";
const CENT = "Round to the nearest cent, and type just the number, with no dollar sign or commas.";
const SOLS = "List every solution, separated by commas. Leave out any extraneous ones.";

/**
 * A logarithm as LaTeX. \log\nolimits_{b} renders exactly like \log_{b}, but the
 * validator can read it back (it can't read \log_{b}). Base 10 is plain \log, "e" is \ln.
 */
const L = (b: number | string) => (b === 10 ? "\\log" : b === "e" ? "\\ln" : `\\log\\nolimits_{${b}}`);
/** The same logarithm as typed text, for hidden verify equations and answer keys. */
const Lt = (b: number | string) => (b === 10 ? "log" : b === "e" ? "ln" : `log_${b}`);

/** Tidy a float for display: 1.0600000000001 -> "1.06". */
const num = (x: number) => String(Number(x.toPrecision(12)));

/** x rounded to d decimal places, or null when x is too close to a rounding tie to trust. */
function rounded(x: number, d: number): string | null {
  const s = x * 10 ** d;
  if (Math.abs(s - Math.floor(s) - 0.5) < 1e-3) return null;
  return (Math.round(s) / 10 ** d).toFixed(d);
}

/** e^(kx) as answer text and LaTeX. */
const ex = (k: number) => ({ text: k === 1 ? "e^x" : `e^(${k}x)`, tex: `e^{${k === 1 ? "" : k}x}` });

/** Is n a whole power of b (including b^0 = 1)? */
function isPowerOf(n: number, b: number): boolean {
  while (n > 1 && n % b === 0) n /= b;
  return n === 1;
}

// ── Lesson 1: Exponential growth and decay ──────────────────────────────────

const PERCENTS = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40];

const evaluateExponential: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const b = r.int(2, 5);
    const n = r.int(2, b <= 3 ? 4 : 3);
    const a = r.int(2, 6);
    const p = b ** n;
    return {
      prompt: md`Evaluate $${a} \cdot ${b}^{x}$ when $x = ${n}$.`,
      answer: String(a * p),
      hint: md`Exponent first: work out $${b}^{${n}}$, then multiply by ${a}. Only the ${b} is raised to the power.`,
      solution: [
        { math: md`${a} \cdot ${b}^{${n}}`, note: "Substitute." },
        { math: md`${a} \cdot ${p}`, note: md`$${b}^{${n}}$ is ${n} factors of ${b}.` },
        { math: String(a * p), note: md`Not $(${a} \cdot ${b})^{${n}}$: the exponent belongs to the base $${b}$ alone.` },
      ],
    };
  }
  if (kind === 1) {
    const d = r.pick([2, 3, 4]);
    const n = r.int(2, d === 2 ? 4 : 3);
    const c = r.int(1, 5);
    const a = c * d ** n;
    return {
      prompt: md`Evaluate $${a}\left(\frac{1}{${d}}\right)^{x}$ when $x = ${n}$.`,
      answer: String(c),
      hint: md`$\left(\frac{1}{${d}}\right)^{${n}} = \frac{1}{${d}^{${n}}}$. Each step of 1 in $x$ divides by ${d}.`,
      solution: [
        { math: md`${a}\left(\frac{1}{${d}}\right)^{${n}} = ${a} \cdot \frac{1}{${d ** n}}`, note: md`A power of a fraction is the power of the top over the power of the bottom.` },
        { math: md`\frac{${a}}{${d ** n}} = ${c}`, note: md`The starting value ${a} was divided by ${d}, ${n} times over.` },
      ],
    };
  }
  if (kind === 2) {
    const b = r.int(2, 5);
    const n = r.int(1, b === 2 ? 3 : 2);
    const a = r.int(1, 9);
    const p = b ** n;
    return {
      prompt: md`Evaluate $${a} \cdot ${b}^{x}$ when $x = -${n}$. Give an exact answer.`,
      answer: frac(a, p),
      hint: md`A negative exponent means a reciprocal: $${b}^{-${n}} = \frac{1}{${b}^{${n}}}$.`,
      solution: [
        { math: md`${a} \cdot ${b}^{-${n}} = ${a} \cdot \frac{1}{${b}^{${n}}}`, note: md`$b^{-n} = \frac{1}{b^n}$ because $b^{-n} \cdot b^n = b^0 = 1$ (Algebra 1, Unit 6).` },
        { math: md`= \frac{${a}}{${p}}${fracTex(a, p) !== `\\frac{${a}}{${p}}` ? ` = ${fracTex(a, p)}` : ""}`, note: "Going left on the graph, the values shrink toward 0 but stay positive." },
      ],
    };
  }
  const rate = r.pick(PERCENTS);
  const up = r.next() < 0.5;
  const b = num(1 + (up ? rate : -rate) / 100);
  const word = up ? "grows" : "shrinks";
  if (kind === 3) {
    return {
      prompt: md`A quantity ${word} by ${rate}% each year, so each year it is multiplied by the same growth factor $b$. Find $b$ as a decimal.`,
      answer: b,
      // A starting amount of 100 becomes 100 + rate (or 100 - rate) after one year.
      verify: [`100b = 100 ${up ? "+" : "-"} ${rate}`],
      hint: md`${up ? "Adding" : "Taking away"} ${rate}% of an amount $A$ leaves $A ${up ? "+" : "-"} ${num(rate / 100)}A$. Factor out $A$.`,
      solution: [
        { math: md`A ${up ? "+" : "-"} ${num(rate / 100)}A = A(1 ${up ? "+" : "-"} ${num(rate / 100)})`, note: md`${rate}% is $${num(rate / 100)}$. The distributive property, run backwards.` },
        { math: md`b = ${b}`, note: md`Every year the amount is multiplied by ${b}${up ? "" : ", a number less than 1, which is decay"}.` },
      ],
    };
  }
  const P = r.pick([250, 400, 1200, 5000, 18000]);
  const thing = up ? "A town's population" : "A car's value, in dollars,";
  return {
    prompt: md`${thing} after $t$ years is $f(t) = ${P}(${b})^{t}$. By what percent does it ${up ? "grow" : "shrink"} each year? Give just the number, like 7 for 7%.`,
    answer: String(rate),
    verify: [`1 ${up ? "+" : "-"} r/100 = ${b}`],
    hint: md`The growth factor is $1 + r$ for growth and $1 - r$ for decay, with $r$ as a decimal.`,
    solution: [
      { math: md`${b} = 1 ${up ? "+" : "-"} ${num(rate / 100)}`, note: md`The factor ${b} is ${up ? "more" : "less"} than 1, so this is ${up ? "growth" : "decay"}.` },
      { math: md`${num(rate / 100)} = ${rate}\%`, note: md`Each year it ${up ? "gains" : "loses"} ${rate}% of what it had.` },
    ],
  };
};

const growthModels: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0 || kind === 1) {
    const N0 = r.pick([50, 100, 200, 300, 400, 500]);
    const d = r.pick([2, 3, 4, 5, 6, 8]);
    const k = r.int(2, 5);
    const t = k * d;
    const N = N0 * 2 ** k;
    const unit = r.pick(["hours", "days"]);
    const model: Step = { math: md`N = ${N0} \cdot 2^{t/${d}}`, note: md`The exponent $\frac{t}{${d}}$ counts how many doubling periods have passed.` };
    if (kind === 0) {
      return {
        prompt: md`A culture starts with ${N0} bacteria and doubles every ${d} ${unit}. How many bacteria are there after ${t} ${unit}?`,
        answer: String(N),
        verify: [`N = ${N0} * 2^(${t}/${d})`],
        hint: md`How many doublings fit into ${t} ${unit}?`,
        solution: [
          model,
          { math: md`N = ${N0} \cdot 2^{${t}/${d}} = ${N0} \cdot 2^{${k}}`, note: md`${t} ${unit} is ${k} doubling periods.` },
          { math: md`N = ${N0} \cdot ${2 ** k} = ${N}`, note: "" },
        ],
      };
    }
    return {
      prompt: md`A culture starts with ${N0} bacteria and doubles every ${d} ${unit}. After how many ${unit} are there ${N} bacteria?`,
      answer: String(t),
      verify: [`${N0} * 2^(t/${d}) = ${N}`],
      hint: md`Divide ${N} by ${N0} to see the total growth factor. How many doublings make that factor?`,
      solution: [
        model,
        { math: md`${N0} \cdot 2^{t/${d}} = ${N} \;\Rightarrow\; 2^{t/${d}} = ${2 ** k}`, note: md`Divide both sides by ${N0}.` },
        { math: md`2^{t/${d}} = 2^{${k}} \;\Rightarrow\; \frac{t}{${d}} = ${k}`, note: md`$${2 ** k} = 2^{${k}}$: that's ${k} doublings.` },
        { math: md`t = ${t}`, note: md`${k} periods of ${d} ${unit}.` },
      ],
    };
  }
  if (kind === 2 || kind === 3) {
    const c = r.pick([3, 5, 6, 10, 12, 15, 25]);
    const k = r.int(2, 5);
    const h = r.pick([4, 5, 6, 8, 10, 12, 20, 30]);
    const A0 = c * 2 ** k;
    const t = k * h;
    const unit = r.pick(["hours", "days", "years"]);
    const model: Step = { math: md`A = ${A0}\left(\tfrac{1}{2}\right)^{t/${h}}`, note: md`The exponent $\frac{t}{${h}}$ counts half-lives.` };
    if (kind === 2) {
      return {
        prompt: md`A radioactive sample has a mass of ${A0} grams and a half-life of ${h} ${unit}. How many grams are left after ${t} ${unit}?`,
        answer: String(c),
        verify: [`A = ${A0} * (1/2)^(${t}/${h})`],
        hint: md`How many half-lives fit into ${t} ${unit}? Each one halves the mass.`,
        solution: [
          model,
          { math: md`A = ${A0}\left(\tfrac{1}{2}\right)^{${k}} = \frac{${A0}}{${2 ** k}}`, note: md`${t} ${unit} is ${k} half-lives.` },
          { math: md`A = ${c}`, note: md`Halving ${k} times: ${Array.from({ length: k + 1 }, (_, i) => A0 / 2 ** i).join(", ")}.` },
        ],
      };
    }
    return {
      prompt: md`A radioactive sample of ${A0} grams decays to ${c} grams in ${t} ${unit}. What is its half-life, in ${unit}?`,
      answer: String(h),
      verify: [`${A0} * (1/2)^(${t}/h) = ${c}`],
      hint: md`How many times must ${A0} be halved to reach ${c}? Those halvings took ${t} ${unit}.`,
      solution: [
        { math: md`\frac{${c}}{${A0}} = \frac{1}{${2 ** k}} = \left(\tfrac{1}{2}\right)^{${k}}`, note: md`The mass was multiplied by $\frac{1}{2}$ a total of ${k} times.` },
        { math: md`${k} \text{ half-lives} = ${t} \text{ ${unit}}`, note: "" },
        { math: md`h = \frac{${t}}{${k}} = ${h}`, note: md`Check: $${A0}\left(\frac12\right)^{${t}/${h}} = ${A0}\left(\frac12\right)^{${k}} = ${c}$.` },
      ],
    };
  }
  // Percent change with a value that comes out to whole cents.
  for (;;) {
    const P = r.pick([1000, 2000, 2500, 4000, 5000, 8000, 10000, 20000]);
    const rate = r.pick([2, 4, 5, 10, 15, 20, 25]);
    const t = r.int(2, 3);
    const up = r.next() < 0.5;
    const top = P * (100 + (up ? rate : -rate)) ** t;
    if (top % 100 ** (t - 1) !== 0) continue;
    const V = top / 100 ** t;
    const b = num(1 + (up ? rate : -rate) / 100);
    const powered = num((1 + (up ? rate : -rate) / 100) ** t);
    return {
      prompt: up
        ? md`A painting is worth ${P} dollars, and its value grows by ${rate}% each year. What is it worth after ${t} years, in dollars?`
        : md`A car is worth ${P} dollars, and it loses ${rate}% of its value each year. What is it worth after ${t} years, in dollars?`,
      answer: num(V),
      verify: [`V = ${P}(1 ${up ? "+" : "-"} ${rate}/100)^${t}`],
      hint: md`Each year multiplies the value by $${b}$. Do that ${t} times.`,
      solution: [
        { math: md`V(t) = ${P}(${b})^{t}`, note: md`${up ? "Gaining" : "Losing"} ${rate}% means multiplying by $1 ${up ? "+" : "-"} ${num(rate / 100)} = ${b}$.` },
        { math: md`V(${t}) = ${P}(${b})^{${t}} = ${P}(${powered})`, note: md`${t} years, ${t} multiplications.` },
        { math: md`V(${t}) = ${num(V)}`, note: up ? "" : md`Not $${P} - ${t} \cdot ${(P * rate) / 100}$: each year's ${rate}% is taken from a smaller value.` },
      ],
    };
  }
};

const findModel: Generator = (r) => {
  const kind = r.int(0, 2);
  let a: number, bNum: number, bDen: number, x1: number, x2: number;
  if (kind === 0) {
    bNum = r.int(2, 5);
    bDen = 1;
    a = r.int(2, 6);
    x1 = 0;
    x2 = r.int(1, bNum <= 3 ? 3 : 2);
  } else if (kind === 1) {
    bNum = r.int(2, 3);
    bDen = 1;
    a = r.int(1, 5);
    x1 = 1;
    x2 = 3;
  } else {
    bNum = 1;
    bDen = r.pick([2, 3, 4]);
    const c = r.int(1, bDen === 2 ? 6 : 3);
    x1 = 0;
    x2 = r.int(1, 2);
    a = c * bDen ** x2;
  }
  const bVal = bNum / bDen;
  const bText = bDen === 1 ? String(bNum) : `1/${bDen}`;
  const bTex = bDen === 1 ? String(bNum) : `\\frac{1}{${bDen}}`;
  const y = (x: number) => (a * bNum ** x) / bDen ** x;
  const [y1, y2] = [y(x1), y(x2)];
  const gap = x2 - x1;
  const ratio = fracTex(y2, y1);
  const top = Math.max(y1, y2);
  /** b^n in LaTeX, with the fraction bracketed. */
  const bPow = (n: number | string) => (bDen === 1 ? `${bNum}^{${n}}` : `\\left(${bTex}\\right)^{${n}}`);
  const bToThe = (n: number) => (n === 1 ? "b" : `b^{${n}}`);
  const figure: Figure = {
    kind: "plot",
    x: [-1, Math.max(4, x2 + 1)],
    y: [-1, Math.ceil(Math.max(top, a) * 1.25)],
    curves: [{ expr: bDen === 1 ? `${a}*${bNum}^x` : `${a}*(1/${bDen})^x` }],
    points: [
      { x: x1, y: y1, label: md`(${x1}, ${y1})`, color: 2 },
      { x: x2, y: y2, label: md`(${x2}, ${y2})`, color: 2 },
    ],
  };
  const steps: Step[] =
    x1 === 0
      ? [
          { math: md`a \cdot b^0 = ${y1} \;\Rightarrow\; a = ${a}`, note: md`At $x = 0$, $b^0 = 1$, so the $y$-intercept is $a$ itself.` },
          { math: md`${a} \cdot ${bToThe(x2)} = ${y2} \;\Rightarrow\; ${bToThe(x2)} = ${ratio}`, note: md`Substitute the second point and divide by ${a}.` },
          ...(x2 === 1 ? [] : [{ math: md`b = ${bTex}`, note: md`$${bPow(x2)} = ${ratio}$${x2 % 2 === 0 ? ", and $b$ must be positive" : ""}.` }]),
        ]
      : [
          { math: md`ab = ${y1}, \quad ab^{${x2}} = ${y2}`, note: md`Each point satisfies $y = ab^x$.` },
          { math: md`\frac{ab^{${x2}}}{ab} = \frac{${y2}}{${y1}} \;\Rightarrow\; b^{${gap}} = ${ratio}`, note: md`Divide the equations: $a$ cancels, and $\frac{b^{${x2}}}{b^{${x1}}} = b^{${gap}}$.` },
          { math: md`b = ${bTex}`, note: md`$b$ must be positive.` },
          { math: md`a = \frac{${y1}}{${bTex}} = ${a}`, note: md`From the first equation, $a \cdot ${bTex} = ${y1}$.` },
        ];
  return {
    prompt: md`The graph of $y = a \cdot b^{x}$ (with $b > 0$) passes through $(${x1}, ${y1})$ and $(${x2}, ${y2})$. Find $a$ and $b$. Give them as $(a, b)$.`,
    answer: `(${a}, ${bText})`,
    form: "tuple",
    figure,
    verify: [`a*b^${x1} = ${y1}`, `a*b^${x2} = ${y2}`],
    hint:
      x1 === 0
        ? md`At $x = 0$ the power is 1, so $y = a$. Then use the other point to find $b$.`
        : md`Write both equations and divide one by the other. The $a$'s cancel.`,
    solution: [...steps, { math: md`y = ${a} \cdot ${bPow("x")}`, note: md`Check: at $x = ${x2}$, $${a} \cdot ${bPow(x2)} = ${y2}$. (${bVal > 1 ? "Growth" : "Decay"}, since $b ${bVal > 1 ? ">" : "<"} 1$.)` }],
  };
};

// ── Lesson 2: The number e ──────────────────────────────────────────────────

const COMPOUND: [number, string][] = [
  [1, "once a year"],
  [2, "twice a year"],
  [4, "quarterly"],
  [12, "monthly"],
];

const compoundInterest: Generator = (r) => {
  for (;;) {
    const P = r.pick([500, 1000, 1500, 2000, 2500, 4000, 5000, 10000]);
    const rate = r.pick([2, 3, 4, 5, 6, 8]);
    const [n, how] = r.pick(COMPOUND);
    const t = r.int(2, 10);
    const A = P * (1 + rate / 100 / n) ** (n * t);
    const askInterest = r.next() < 0.3;
    const key = rounded(askInterest ? A - P : A, 2);
    if (!key) continue;
    const rr = num(rate / 100);
    const per = n === 1 ? rr : md`\frac{${rr}}{${n}}`;
    const steps: Step[] = [
      { math: md`A = P\left(1 + \frac{r}{n}\right)^{nt}`, note: md`$P = ${P}$, $r = ${rr}$ (${rate}% as a decimal), $n = ${n}$ payments a year, $t = ${t}$ years.` },
      { math: md`A = ${P}\left(1 + ${per}\right)^{${n * t}}`, note: md`${n === 1 ? "One payment" : `${n} payments`} a year for ${t} years is $${n} \cdot ${t} = ${n * t}$ payments.` },
      { math: md`A \approx ${(Math.round(A * 100) / 100).toFixed(2)}`, note: "Use a calculator and keep every digit until the last step." },
    ];
    if (askInterest) steps.push({ math: md`A - P \approx ${key}`, note: md`The interest is what was added to the ${P} dollars deposited.` });
    return {
      prompt: askInterest
        ? md`You deposit ${P} dollars in an account that pays ${rate}% interest a year, compounded ${how}. How much interest has it earned after ${t} years? ${CENT}`
        : md`You deposit ${P} dollars in an account that pays ${rate}% interest a year, compounded ${how}. How much is in the account after ${t} years? ${CENT}`,
      answer: key,
      hint: md`Use $A = P\left(1 + \frac{r}{n}\right)^{nt}$ with $r$ as a decimal and $n$ the number of payments per year.${askInterest ? " Then subtract the deposit." : ""}`,
      solution: steps,
    };
  }
};

const continuousGrowth: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 1) {
    const P = r.pick([200, 500, 1000, 3000, 5000]);
    const rate = r.pick([2, 3, 4, 5, 6, 8]);
    const t = r.pick([5, 10, 15, 20, 25]);
    const rr = num(rate / 100);
    const rt = num((rate * t) / 100);
    return {
      prompt: md`You invest ${P} dollars at ${rate}% a year, compounded continuously. Write the exact amount after ${t} years, using $e$ (type $e^{0.3}$ as e^(0.3)).`,
      answer: `${P}e^(${rt})`,
      verify: [`A = ${P}e^(${rr} * ${t})`],
      hint: md`Continuous growth is $A = Pe^{rt}$, with $r$ as a decimal.`,
      solution: [
        { math: md`A = Pe^{rt} = ${P}e^{${rr} \cdot ${t}}`, note: md`$r = ${rr}$ and $t = ${t}$.` },
        { math: md`A = ${P}e^{${rt}}`, note: md`About ${(P * Math.exp((rate * t) / 100)).toFixed(2)} dollars, but the exact answer keeps $e$.` },
      ],
    };
  }
  for (;;) {
    if (kind === 0) {
      const P = r.pick([500, 1000, 2000, 2500, 5000, 8000]);
      const rate = r.pick([2, 3, 4, 5, 6, 7, 8]);
      const t = r.int(2, 20);
      const rr = num(rate / 100);
      const A = P * Math.exp((rate * t) / 100);
      const key = rounded(A, 2);
      if (!key) continue;
      return {
        prompt: md`You invest ${P} dollars at ${rate}% a year, compounded continuously. How much do you have after ${t} years? ${CENT}`,
        answer: key,
        hint: md`Use $A = Pe^{rt}$ with $r = ${rr}$.`,
        solution: [
          { math: md`A = Pe^{rt} = ${P}e^{${rr} \cdot ${t}}`, note: "Continuous compounding: the limit of compounding more and more often." },
          { math: md`A = ${P}e^{${num((rate * t) / 100)}}`, note: "" },
          { math: md`A \approx ${key}`, note: md`$e^{${num((rate * t) / 100)}} \approx ${Math.exp((rate * t) / 100).toFixed(6)}$.` },
        ],
      };
    }
    if (kind === 2) {
      const P = r.pick([1200, 2500, 4000, 8000, 15000]);
      const rate = r.pick([1, 2, 3, 4, 5]);
      const t = r.int(5, 20);
      const rr = num(rate / 100);
      const A = P * Math.exp((rate * t) / 100);
      const key = rounded(A, 0);
      if (!key) continue;
      return {
        prompt: md`A town of ${P} people grows continuously at ${rate}% a year. What is its population after ${t} years? Round to the nearest whole number.`,
        answer: key,
        hint: md`Continuous growth: $P(t) = P_0 e^{rt}$ with $r = ${rr}$.`,
        solution: [
          { math: md`P(t) = ${P}e^{${rr}t}`, note: md`Starting value ${P}, continuous rate ${rr}.` },
          { math: md`P(${t}) = ${P}e^{${num((rate * t) / 100)}}`, note: "" },
          { math: md`P(${t}) \approx ${A.toFixed(2)} \approx ${key}`, note: "People come in whole numbers, so round." },
        ],
      };
    }
    const A0 = r.pick([100, 200, 250, 400, 500]);
    const rate = r.pick([10, 15, 20, 25, 30]);
    const t = r.int(2, 8);
    const rr = num(rate / 100);
    const A = A0 * Math.exp((-rate * t) / 100);
    const key = rounded(A, 1);
    if (!key) continue;
    return {
      prompt: md`A dose of ${A0} mg of a medicine leaves the bloodstream continuously at a rate of ${rate}% per hour. How much is left after ${t} hours? Round to the nearest tenth of a milligram.`,
      answer: key,
      hint: md`Continuous decay is $A = A_0 e^{-rt}$, with the rate $r$ written as a positive decimal.`,
      solution: [
        { math: md`A = ${A0}e^{-${rr}t}`, note: md`Decay at ${rate}% per hour: $r = ${rr}$, and the exponent is $-${rr}t$.` },
        { math: md`A = ${A0}e^{-${num((rate * t) / 100)}}`, note: md`$${rr} \cdot ${t} = ${num((rate * t) / 100)}$.` },
        { math: md`A \approx ${A.toFixed(3)} \approx ${key}`, note: "Positive exponent would mean growth; the minus sign makes it shrink." },
      ],
    };
  }
};

const eAndExponents: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = r.int(1, 6);
    const withConst = r.next() < 0.35;
    if (withConst) {
      const c = r.int(2, 6);
      const ans = `e^(${poly([[a, "x"], [c, ""]])})`;
      return {
        prompt: md`Simplify $${ex(a).tex} \cdot e^{${c}}$. Write it as a single power of $e$.`,
        answer: ans,
        simplified: true,
        hint: md`$e$ is a number, so the product rule $b^m \cdot b^n = b^{m + n}$ applies.`,
        solution: [
          { math: md`${ex(a).tex} \cdot e^{${c}} = e^{${poly([[a, "x"], [c, ""]])}}`, note: "Same base: add the exponents. They aren't like terms, so the sum stays as it is." },
        ],
      };
    }
    const b = r.int(1, 6);
    return {
      prompt: md`Simplify $${ex(a).tex} \cdot ${ex(b).tex}$. Write it as a single power of $e$.`,
      answer: ex(a + b).text,
      simplified: true,
      hint: md`$e$ is a number, so the product rule $b^m \cdot b^n = b^{m + n}$ applies.`,
      solution: [{ math: md`${ex(a).tex} \cdot ${ex(b).tex} = e^{${poly([[a, "x"], [b, "x"]])}} = ${ex(a + b).tex}`, note: "Same base: add the exponents." }],
    };
  }
  if (kind === 1) {
    const b = r.int(1, 5);
    const a = b + r.int(1, 5);
    return {
      prompt: md`Simplify $\frac{${ex(a).tex}}{${ex(b).tex}}$. Write it as a single power of $e$.`,
      answer: ex(a - b).text,
      simplified: true,
      hint: md`Quotient rule: $\frac{b^m}{b^n} = b^{m - n}$.`,
      solution: [{ math: md`\frac{${ex(a).tex}}{${ex(b).tex}} = e^{${a}x - ${b === 1 ? "" : b}x} = ${ex(a - b).tex}`, note: "Same base: subtract the exponents." }],
    };
  }
  if (kind === 2) {
    const a = r.int(2, 5);
    const k = r.int(2, 4);
    return {
      prompt: md`Simplify $\left(${ex(a).tex}\right)^{${k}}$. Write it as a single power of $e$.`,
      answer: ex(a * k).text,
      simplified: true,
      hint: md`Power rule: $(b^m)^n = b^{mn}$.`,
      solution: [{ math: md`\left(${ex(a).tex}\right)^{${k}} = e^{${a}x \cdot ${k}} = ${ex(a * k).tex}`, note: "A power of a power: multiply the exponents." }],
    };
  }
  const n = r.int(2, 5);
  const [top, bottom] = [(n + 1) ** n, n ** n];
  return {
    prompt: md`Evaluate $\left(1 + \frac{1}{n}\right)^{n}$ when $n = ${n}$. Give an exact fraction.`,
    answer: frac(top, bottom),
    hint: md`$1 + \frac{1}{${n}} = \frac{${n + 1}}{${n}}$. Raise the top and the bottom to the power ${n}.`,
    solution: [
      { math: md`\left(1 + \frac{1}{${n}}\right)^{${n}} = \left(\frac{${n + 1}}{${n}}\right)^{${n}}`, note: "Write the sum as one fraction." },
      { math: md`= \frac{${n + 1}^{${n}}}{${n}^{${n}}} = \frac{${top}}{${bottom}}`, note: md`About ${(top / bottom).toFixed(4)}: one more row of the table that creeps up toward $e \approx 2.71828$.` },
    ],
  };
};

// ── Lesson 3: Logarithms as inverse exponents ───────────────────────────────

const evaluateLog: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0 || kind === 1) {
    const b = r.pick([2, 3, 4, 5, 6, 10]);
    const maxK = b === 2 ? 7 : b === 3 ? 5 : b === 10 ? 4 : 3;
    const k = r.int(kind === 0 ? 2 : 1, maxK);
    const N = b ** k;
    if (kind === 0) {
      return {
        prompt: md`Evaluate $${L(b)} ${N}$.`,
        answer: String(k),
        hint: md`Ask: ${b} to what power is ${N}?`,
        solution: [
          { math: md`${L(b)} ${N} = x \iff ${b}^{x} = ${N}`, note: "A logarithm is an exponent. Rewrite it as the question it answers." },
          { math: md`${N} = ${b}^{${k}}`, note: md`Multiply ${b}'s until you reach ${N}.` },
          { math: md`${L(b)} ${N} = ${k}`, note: "" },
        ],
      };
    }
    return {
      prompt: md`Evaluate $${L(b)} \frac{1}{${N}}$.`,
      answer: String(-k),
      hint: md`A reciprocal is a negative exponent: $\frac{1}{${b}^{n}} = ${b}^{-n}$.`,
      solution: [
        { math: md`\frac{1}{${N}} = \frac{1}{${b}^{${k}}} = ${b}^{-${k}}`, note: md`$${N} = ${b}^{${k}}$, and $b^{-n} = \frac{1}{b^n}$.` },
        { math: md`${L(b)} \frac{1}{${N}} = -${k}`, note: "Numbers between 0 and 1 have negative logarithms (for a base above 1)." },
      ],
    };
  }
  if (kind === 2) {
    const c = r.pick([2, 3, 5]);
    const m = c === 2 ? r.int(2, 3) : 2;
    const maxN = c === 2 ? 7 : c === 3 ? 5 : 3;
    let n = r.int(1, maxN);
    while (n % m === 0) n = r.int(1, maxN);
    const [B, N] = [c ** m, c ** n];
    return {
      prompt: md`Evaluate $${L(B)} ${N}$. Give an exact answer.`,
      answer: frac(n, m),
      hint: md`Write ${B} and ${N} as powers of the same number, ${c}.`,
      solution: [
        { math: md`${B}^{x} = ${N}`, note: "The question the logarithm asks." },
        { math: md`(${c}^{${m}})^{x} = ${c}^{${n}} \;\Rightarrow\; ${c}^{${m}x} = ${c}^{${n}}`, note: md`$${B} = ${c}^{${m}}$ and $${N} = ${c}^{${n}}$. Power rule on the left.` },
        { math: md`${m}x = ${n} \;\Rightarrow\; x = ${fracTex(n, m)}`, note: md`Equal powers of ${c} have equal exponents, because $${c}^{x}$ is one-to-one.` },
      ],
    };
  }
  if (kind === 3) {
    const sub = r.int(0, 3);
    if (sub === 0) {
      const k = r.pick([-3, -2, -1, 2, 3, 4, 5, 6]);
      return {
        prompt: md`Evaluate $\ln e^{${k}}$.`,
        answer: String(k),
        hint: md`$\ln$ is $\log_e$. It asks: $e$ to what power gives this?`,
        solution: [{ math: md`\ln e^{${k}} = ${k}`, note: md`$\ln$ undoes $e^x$: $\ln e^{x} = x$ for every $x$.` }],
      };
    }
    if (sub === 1) {
      const root = r.next() < 0.5;
      const k = r.int(2, 4);
      return root
        ? {
            prompt: md`Evaluate $\ln \sqrt[${k}]{e}$. Give an exact answer.`,
            answer: `1/${k}`,
            hint: md`Write the root as a rational exponent (Unit 5): $\sqrt[n]{e} = e^{1/n}$.`,
            solution: [
              { math: md`\sqrt[${k}]{e} = e^{1/${k}}`, note: md`An $n$th root is the power $\frac{1}{n}$.` },
              { math: md`\ln e^{1/${k}} = \frac{1}{${k}}`, note: "" },
            ],
          }
        : {
            prompt: md`Evaluate $\ln \frac{1}{e^{${k}}}$.`,
            answer: String(-k),
            hint: md`$\frac{1}{e^{${k}}} = e^{-${k}}$.`,
            solution: [
              { math: md`\frac{1}{e^{${k}}} = e^{-${k}}`, note: "A reciprocal is a negative exponent." },
              { math: md`\ln e^{-${k}} = -${k}`, note: "" },
            ],
          };
    }
    if (sub === 2) {
      const k = r.int(1, 4);
      const dec = (10 ** -k).toFixed(k);
      return {
        prompt: md`Evaluate $\log ${dec}$.`,
        answer: String(-k),
        hint: md`$\log$ with no base means base 10. Write ${dec} as a power of 10.`,
        solution: [
          { math: md`${dec} = \frac{1}{${10 ** k}} = 10^{-${k}}`, note: "Count the decimal places." },
          { math: md`\log ${dec} = -${k}`, note: "" },
        ],
      };
    }
    const b = r.pick([2, 3, 5, 7, 9, 12]);
    const one = r.next() < 0.5;
    return {
      prompt: md`Evaluate $${L(b)} ${one ? 1 : b}$.`,
      answer: one ? "0" : "1",
      hint: one ? md`What power of any base gives 1?` : md`${b} to what power is ${b}?`,
      solution: [{ math: md`${b}^{${one ? 0 : 1}} = ${one ? 1 : b} \;\Rightarrow\; ${L(b)} ${one ? 1 : b} = ${one ? 0 : 1}`, note: one ? md`$b^0 = 1$ for every base, so $\log_b 1 = 0$.` : md`$b^1 = b$, so $\log_b b = 1$.` }],
    };
  }
  const sub = r.int(0, 2);
  if (sub === 0) {
    const b = r.pick([2, 3, 5, 6, 7]);
    const N = r.int(2, 30);
    return {
      prompt: md`Evaluate $${b}^{${L(b)} ${N}}$.`,
      answer: String(N),
      hint: md`$${L(b)} ${N}$ is, by definition, the exponent that turns ${b} into ${N}.`,
      solution: [{ math: md`${b}^{${L(b)} ${N}} = ${N}`, note: md`Raise ${b} to the power that gives ${N}, and you get ${N}. The two functions undo each other.` }],
    };
  }
  if (sub === 1) {
    const N = r.int(2, 30);
    return {
      prompt: md`Evaluate $e^{\ln ${N}}$.`,
      answer: String(N),
      hint: md`$\ln ${N}$ is the power of $e$ that gives ${N}.`,
      solution: [{ math: md`e^{\ln ${N}} = ${N}`, note: md`$e^x$ and $\ln x$ are inverse functions, so one undoes the other.` }],
    };
  }
  const b = r.pick([2, 3, 6, 7, 11]);
  const q = r.pick([1.5, 2.5, 0.5, 3.5, 4.2, 0.7]);
  return {
    prompt: md`Evaluate $${L(b)} ${b}^{${q}}$.`,
    answer: String(q),
    hint: md`${b} to what power gives $${b}^{${q}}$?`,
    solution: [{ math: md`${L(b)} ${b}^{${q}} = ${q}`, note: md`$\log_b b^x = x$: the logarithm reads off the exponent, whatever it is.` }],
  };
};

const solveLogEquation: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const b = r.pick([2, 3, 4, 5, 10]);
    const maxK = b === 2 ? 6 : b === 3 ? 4 : 3;
    const k = r.int(-2, maxK);
    const ans = k >= 0 ? String(b ** k) : frac(1, b ** -k);
    return {
      prompt: md`Solve $${L(b)} x = ${k}$.`,
      answer: ans,
      hint: md`Rewrite in exponential form: $\log_b x = k$ means $x = b^k$.`,
      solution: [
        { math: md`x = ${b}^{${k}}`, note: "The logarithm is the exponent; the base raised to it gives x." },
        { math: md`x = ${k >= 0 ? ans : fracTex(1, b ** -k)}`, note: k < 0 ? "A negative exponent is a reciprocal." : k === 0 ? md`Any base to the power 0 is 1.` : "" },
      ],
    };
  }
  if (kind === 1) {
    const b = r.pick([2, 3, 5]);
    const k = r.int(1, b === 2 ? 4 : 2);
    const a = r.int(2, 5);
    let x0 = r.int(-3, 6);
    let c = b ** k - a * x0;
    while (c === 0) {
      x0 = r.int(-3, 6);
      c = b ** k - a * x0;
    }
    return {
      prompt: md`Solve $${L(b)}(${poly([[a, "x"], [c, ""]])}) = ${k}$.`,
      answer: String(x0),
      hint: md`Rewrite in exponential form first: the inside equals $${b}^{${k}}$.`,
      solution: [
        { math: md`${poly([[a, "x"], [c, ""]])} = ${b}^{${k}} = ${b ** k}`, note: "Exponential form." },
        { math: md`${a}x = ${b ** k - c}`, note: md`${c > 0 ? "Subtract" : "Add"} ${Math.abs(c)} on both sides.` },
        { math: md`x = ${x0}`, note: md`Check: the inside is $${a}(${x0}) ${signed(c)} = ${b ** k}$, which is positive, so the logarithm exists.` },
      ],
    };
  }
  if (kind === 2) {
    const half = r.next() < 0.3;
    if (half) {
      const c = r.int(2, 9);
      return {
        prompt: md`Solve $${L("x")} ${c} = \frac{1}{2}$.`,
        answer: String(c * c),
        hint: md`Exponential form: $x^{1/2} = ${c}$, so $\sqrt{x} = ${c}$.`,
        solution: [
          { math: md`x^{1/2} = ${c}`, note: md`$\log_x ${c} = \frac{1}{2}$ means the base $x$ to the power $\frac12$ is ${c}.` },
          { math: md`x = ${c}^2 = ${c * c}`, note: md`Square both sides. Check: $\sqrt{${c * c}} = ${c}$.` },
        ],
      };
    }
    const c = r.int(2, 6);
    const k = r.int(2, c <= 3 ? 4 : 3);
    const N = c ** k;
    return {
      prompt: md`Solve $${L("x")} ${N} = ${k}$.`,
      answer: String(c),
      hint: md`Exponential form: $x^{${k}} = ${N}$.`,
      solution: [
        { math: md`x^{${k}} = ${N}`, note: "The base, raised to the logarithm, gives the number." },
        { math: md`x = ${c}`, note: k % 2 === 0 ? md`$${-c}$ also has $(${-c})^{${k}} = ${N}$, but a base must be positive.` : md`$${c}^{${k}} = ${N}$.` },
      ],
    };
  }
  if (kind === 3) {
    const k = r.nonzero(-2, 5);
    const c = r.int(-6, 6);
    const ans = c === 0 ? `e^(${k})` : `e^(${k}) ${c > 0 ? "-" : "+"} ${Math.abs(c)}`;
    const ansTex = c === 0 ? `e^{${k}}` : `e^{${k}} ${c > 0 ? "-" : "+"} ${Math.abs(c)}`;
    return {
      prompt: md`Solve $\ln${c === 0 ? " x" : `(${poly([[1, "x"], [c, ""]])})`} = ${k}$. Give an exact answer (type $e^{2}$ as e^2).`,
      answer: ans,
      hint: md`$\ln$ is $\log_e$, so exponential form uses base $e$.`,
      solution: [
        { math: md`${poly([[1, "x"], [c, ""]])} = e^{${k}}`, note: "Exponential form with base e." },
        ...(c === 0 ? [] : [{ math: md`x = ${ansTex}`, note: md`${c > 0 ? "Subtract" : "Add"} ${Math.abs(c)}. That's roughly ${num(Number((Math.exp(k) - c).toFixed(3)))}.` }]),
      ],
    };
  }
  const a = r.pick([2, 4, 5, 8]);
  const k = r.int(1, 3);
  return {
    prompt: md`Solve $\log(${a}x) = ${k}$. Give an exact answer.`,
    answer: frac(10 ** k, a),
    hint: md`$\log$ means base 10: $${a}x = 10^{${k}}$.`,
    solution: [
      { math: md`${a}x = 10^{${k}} = ${10 ** k}`, note: "Exponential form, base 10." },
      { math: md`x = ${fracTex(10 ** k, a)}`, note: md`Divide by ${a}.` },
    ],
  };
};

const logGraphsAndInverses: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const [b, k] = r.pick([
      [2, 2],
      [2, 3],
      [3, 2],
      [4, 2],
      [5, 2],
      [2, 4],
    ] as const);
    const N = b ** k;
    const figure: Figure = {
      kind: "plot",
      x: [-1, N + 2],
      y: [-3, k + 2],
      curves: [{ expr: `log_${b}(x)` }],
      points: [
        { x: 1, y: 0, label: md`(1, 0)`, color: 3 },
        { x: N, y: k, label: md`(${N}, ${k})`, color: 2 },
      ],
    };
    return {
      prompt: md`The graph of $y = \log_b x$ passes through $(1, 0)$ and $(${N}, ${k})$. Find the base $b$.`,
      answer: String(b),
      figure,
      verify: [`log_b(${N}) = ${k}`],
      hint: md`The point says $\log_b ${N} = ${k}$. Rewrite that in exponential form.`,
      solution: [
        { math: md`\log_b ${N} = ${k} \iff b^{${k}} = ${N}`, note: "A point on the graph is an input and its logarithm." },
        { math: md`b = ${b}`, note: md`$${b}^{${k}} = ${N}$, and a base must be positive. Every log graph passes through $(1, 0)$, so that point can't tell you the base.` },
      ],
    };
  }
  if (kind === 1) {
    const b = r.pick([2, 3, 5]);
    const k = r.int(1, b === 2 ? 5 : 3);
    const c = r.int(-5, 5);
    const N = b ** k + c;
    const fx = c === 0 ? `${b}^{x}` : `${b}^{x} ${signed(c)}`;
    return {
      prompt: md`Let $f(x) = ${fx}$. Find $f^{-1}(${N})$.`,
      answer: String(k),
      verify: [`${b}^x ${c === 0 ? "" : signed(c)} = ${N}`],
      hint: md`$f^{-1}(${N})$ is the input that $f$ sends to ${N}. Solve $f(x) = ${N}$.`,
      solution: [
        { math: md`${fx} = ${N}`, note: "The inverse sends the output back to its input (Unit 1)." },
        ...(c === 0 ? [] : [{ math: md`${b}^{x} = ${b ** k}`, note: md`${c > 0 ? "Subtract" : "Add"} ${Math.abs(c)}.` }]),
        { math: md`x = ${L(b)} ${b ** k} = ${k}`, note: md`So $f^{-1}(${N}) = ${k}$. In general $f^{-1}(x) = \log_{${b}}(x ${c === 0 ? "" : signed(-c)})$.`.replace(" )", ")") },
      ],
    };
  }
  if (kind === 2) {
    const b = r.pick([2, 3, 10]);
    const c = r.int(-3, 3);
    const k = r.int(-1, 3);
    const e = k - c;
    const ans = e >= 0 ? String(b ** e) : frac(1, b ** -e);
    const fx = c === 0 ? `${L(b)} x` : `${L(b)} x ${signed(c)}`;
    return {
      prompt: md`Let $f(x) = ${fx}$. Find $f^{-1}(${k})$.`,
      answer: ans,
      verify: [`${Lt(b)}(x) ${c === 0 ? "" : signed(c)} = ${k}`],
      hint: md`Solve $f(x) = ${k}$: isolate the logarithm, then use exponential form.`,
      solution: [
        { math: md`${fx} = ${k}`, note: md`$f^{-1}(${k})$ is the input with output ${k}.` },
        ...(c === 0 ? [] : [{ math: md`${L(b)} x = ${e}`, note: md`${c > 0 ? "Subtract" : "Add"} ${Math.abs(c)}.` }]),
        { math: md`x = ${b}^{${e}} = ${e >= 0 ? ans : fracTex(1, b ** -e)}`, note: "Exponential form." },
      ],
    };
  }
  const shape = r.int(0, 2);
  const b = r.pick([2, 3, 5, 10, "e"] as const);
  if (shape === 0) {
    const h = r.nonzero(-6, 6);
    return {
      prompt: md`Find the domain of $f(x) = ${L(b)}(${poly([[1, "x"], [-h, ""]])})$. Give it in interval notation (type $\infty$ as inf).`,
      answer: `(${h}, inf)`,
      form: "inequality",
      hint: "You can only take the logarithm of a positive number.",
      solution: [
        { math: md`${poly([[1, "x"], [-h, ""]])} > 0`, note: md`No power of a positive base is 0 or negative, so the inside must be positive.` },
        { math: md`x > ${h}`, note: md`The graph of $y = ${L(b)} x$ shifted ${h > 0 ? "right" : "left"} ${Math.abs(h)} (Unit 1), with its asymptote at $x = ${h}$.` },
        { math: md`(${h}, \infty)`, note: "" },
      ],
    };
  }
  if (shape === 1) {
    const h = r.int(-5, 6);
    return {
      prompt: md`Find the domain of $f(x) = ${L(b)}(${poly([[-1, "x"], [h, ""]])})$. Give it in interval notation (type $\infty$ as inf).`,
      answer: `(-inf, ${h})`,
      form: "inequality",
      hint: "You can only take the logarithm of a positive number.",
      solution: [
        { math: md`${poly([[-1, "x"], [h, ""]])} > 0`, note: "The inside must be positive." },
        { math: md`x < ${h}`, note: md`Add $x$ to both sides. The graph is a mirror image, opening to the left.` },
        { math: md`(-\infty, ${h})`, note: "" },
      ],
    };
  }
  const a = r.int(2, 5);
  const c = r.nonzero(-9, 9);
  const edge = frac(-c, a);
  const edgeTex = fracTex(-c, a);
  return {
    prompt: md`Find the domain of $f(x) = ${L(b)}(${poly([[a, "x"], [c, ""]])})$. Give it in interval notation (type $\infty$ as inf).`,
    answer: `(${edge}, inf)`,
    form: "inequality",
    hint: "You can only take the logarithm of a positive number.",
    solution: [
      { math: md`${poly([[a, "x"], [c, ""]])} > 0`, note: "The inside must be positive." },
      { math: md`${a}x > ${-c} \;\Rightarrow\; x > ${edgeTex}`, note: md`Dividing by a positive ${a} keeps the direction.` },
      { math: md`\left(${edgeTex}, \infty\right)`, note: "" },
    ],
  };
};

// ── Lesson 4: Properties of logarithms ──────────────────────────────────────

function divisorsOf(n: number): number[] {
  const out: number[] = [];
  for (let d = 2; d < n; d++) if (n % d === 0) out.push(d);
  return out;
}

const evaluateWithRules: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const [b, kLo, kHi] = r.pick([
      [6, 2, 3],
      [10, 1, 3],
      [12, 2, 2],
      [15, 2, 2],
      [2, 3, 6],
      [3, 2, 4],
    ] as const);
    const k = r.int(kLo, kHi);
    const all = divisorsOf(b ** k);
    const nice = all.filter((d) => !isPowerOf(d, b) && !isPowerOf(b ** k / d, b));
    const M = r.pick(nice.length ? nice : all);
    const N = b ** k / M;
    return {
      prompt: md`Evaluate $${L(b)} ${M} + ${L(b)} ${N}$.`,
      answer: String(k),
      hint: md`Product rule: $\log_b M + \log_b N = \log_b (MN)$.`,
      solution: [
        { math: md`${L(b)} ${M} + ${L(b)} ${N} = ${L(b)} (${M} \cdot ${N}) = ${L(b)} ${b ** k}`, note: "A sum of logs is the log of the product." },
        { math: md`= ${L(b)} ${b}^{${k}} = ${k}`, note: md`$${b ** k} = ${b}^{${k}}$.${nice.length ? " Neither log on its own is a nice number, but their sum is." : ""}` },
      ],
    };
  }
  if (kind === 1) {
    const b = r.pick([2, 3, 5, 10]);
    const k = r.int(1, b === 2 ? 4 : b === 10 ? 2 : 2);
    const N = r.pick([3, 7, 6, 11].filter((n) => n % b !== 0 && b % n !== 0));
    const M = N * b ** k;
    const flip = r.next() < 0.3;
    const [p, q] = flip ? [N, M] : [M, N];
    return {
      prompt: md`Evaluate $${L(b)} ${p} - ${L(b)} ${q}$.`,
      answer: String(flip ? -k : k),
      hint: md`Quotient rule: $\log_b M - \log_b N = \log_b \frac{M}{N}$.`,
      solution: [
        { math: md`${L(b)} ${p} - ${L(b)} ${q} = ${L(b)} \frac{${p}}{${q}}`, note: "A difference of logs is the log of the quotient." },
        { math: md`= ${L(b)} ${flip ? `\\frac{1}{${b ** k}}` : b ** k} = ${flip ? -k : k}`, note: md`${flip ? `$\\frac{1}{${b ** k}} = ${b}^{-${k}}$` : `$${b ** k} = ${b}^{${k}}$`}.` },
      ],
    };
  }
  if (kind === 2) {
    const b = r.pick([2, 3, 5, 10]);
    const s = r.pick([2, 3, 7].filter((n) => n !== b && b % n !== 0));
    const j = r.int(1, b >= 5 ? 1 : 2);
    const m = s * b ** j;
    return {
      prompt: md`Evaluate $2${L(b)} ${m} - ${L(b)} ${s * s}$.`,
      answer: String(2 * j),
      hint: md`Use the power rule to move the 2 inside first: $2\log_b M = \log_b M^2$.`,
      solution: [
        { math: md`2${L(b)} ${m} = ${L(b)} ${m}^2 = ${L(b)} ${m * m}`, note: "Power rule." },
        { math: md`${L(b)} ${m * m} - ${L(b)} ${s * s} = ${L(b)} \frac{${m * m}}{${s * s}} = ${L(b)} ${b ** (2 * j)}`, note: "Quotient rule." },
        { math: md`= ${2 * j}`, note: md`$${b ** (2 * j)} = ${b}^{${2 * j}}$.` },
      ],
    };
  }
  if (kind === 3) {
    const c = r.pick([2, 3, 5]);
    const maxE = c === 2 ? 6 : c === 3 ? 4 : 3;
    const m = r.int(1, Math.min(3, maxE));
    let n = r.int(1, maxE);
    while (n === m) n = r.int(1, maxE);
    const ln = r.next() < 0.5 ? "\\ln" : "\\log";
    return {
      prompt: md`Evaluate $\frac{${ln} ${c ** n}}{${ln} ${c ** m}}$. Give an exact answer.`,
      answer: frac(n, m),
      hint: md`Write both numbers as powers of ${c}, then use the power rule on the top and the bottom.`,
      solution: [
        { math: md`\frac{${ln} ${n === 1 ? c : `${c}^{${n}}`}}{${ln} ${m === 1 ? c : `${c}^{${m}}`}} = \frac{${n === 1 ? "" : n}${ln} ${c}}{${m === 1 ? "" : m}${ln} ${c}}`, note: m === 1 ? "Power rule on the top." : n === 1 ? "Power rule on the bottom." : "Power rule, top and bottom." },
        { math: md`= ${fracTex(n, m)}`, note: md`$${ln} ${c}$ cancels. By change of base, this is also $\log_{${c ** m}} ${c ** n}$.` },
      ],
    };
  }
  const [p, q] = r.pick([
    [2, 3],
    [3, 2],
    [2, 5],
    [5, 2],
    [3, 5],
  ] as const);
  const a = r.int(1, 2);
  const bb = r.int(1, 2);
  const cc = r.int(1, p === 2 ? 3 : 2);
  const [A, B, C] = [p ** a, q ** bb, p ** cc];
  return {
    prompt: md`Evaluate $${L(A)} ${B} \cdot ${L(q)} ${C}$. Give an exact answer.`,
    answer: frac(bb * cc, a),
    hint: md`Change both to natural logs with $\log_b x = \frac{\ln x}{\ln b}$, then look for cancelling.`,
    solution: [
      { math: md`\frac{\ln ${B}}{\ln ${A}} \cdot \frac{\ln ${C}}{\ln ${q}}`, note: "Change of base, for each factor." },
      {
        math: md`= \frac{${bb === 1 ? "" : bb}\ln ${q}}{${a === 1 ? "" : a}\ln ${p}} \cdot \frac{${cc === 1 ? "" : cc}\ln ${p}}{\ln ${q}}`,
        note: md`Power rule, writing each number as a power of a prime: ${[[B, q, bb], [A, p, a], [C, p, cc]].map(([n, base, e]) => (e === 1 ? md`$${n}$ is prime` : md`$${n} = ${base}^{${e}}$`)).join(", ")}.`,
      },
      { math: a === 1 ? md`= ${bb * cc}` : md`= \frac{${bb * cc}}{${a}}${bb * cc === a || (bb * cc) % a === 0 || fracTex(bb * cc, a) !== `\\frac{${bb * cc}}{${a}}` ? ` = ${fracTex(bb * cc, a)}` : ""}`, note: md`Both $\ln ${p}$ and $\ln ${q}$ cancel.` },
    ],
  };
};

const expandLog: Generator = (r) => {
  const kind = r.int(0, 4);
  const b = r.pick([2, 3, 5, 10]);
  const j = r.int(1, b === 2 ? 3 : 2);
  const P = b ** j;
  const k = r.int(2, 5);
  const T = L(b);
  const t = Lt(b);
  if (kind === 0 || kind === 1) {
    const quotient = kind === 1;
    const inside = quotient ? `\\frac{x^{${k}}}{${P}}` : `${P}x^{${k}}`;
    const typed = (x: number) => (quotient ? `${x}^${k} / ${P}` : `${P} * ${x}^${k}`);
    const p = quotient ? -j : j;
    return {
      prompt: md`Write $${T} ${quotient ? inside : `(${inside})`}$ in the form $p + q${T} x$, for $x > 0$. Give $(p, q)$.`,
      answer: `(${p}, ${k})`,
      form: "tuple",
      // The identity must hold at every x > 0; two inputs pin down p and q.
      verify: [`${t}(${typed(2)}) = p + q*${t}(2)`, `${t}(${typed(7)}) = p + q*${t}(7)`],
      hint: quotient ? md`Quotient rule first, then the power rule on $x^{${k}}$.` : md`Product rule first, then the power rule on $x^{${k}}$.`,
      solution: [
        { math: quotient ? md`${T} x^{${k}} - ${T} ${P}` : md`${T} ${P} + ${T} x^{${k}}`, note: quotient ? "The log of a quotient is a difference." : "The log of a product is a sum." },
        { math: quotient ? md`${k}${T} x - ${j}` : md`${j} + ${k}${T} x`, note: md`$${P} = ${b}^{${j}}$, so its log is ${j}. Power rule: $${T} x^{${k}} = ${k}${T} x$.` },
        { math: md`(p, q) = (${p}, ${k})`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const n = r.int(2, 3);
    const rootTex = n === 2 ? "\\sqrt{x}" : `\\sqrt[${n}]{x}`;
    const typedRoot = (x: number) => `${x}^(1/${n})`;
    return {
      prompt: md`Write $${T}(${P}${rootTex})$ in the form $p + q${T} x$, for $x > 0$. Give $(p, q)$.`,
      answer: `(${j}, 1/${n})`,
      form: "tuple",
      verify: [`${t}(${P} * ${typedRoot(2)}) = p + q*${t}(2)`, `${t}(${P} * ${typedRoot(7)}) = p + q*${t}(7)`],
      hint: md`Write the root as a power (Unit 5): $${rootTex} = x^{1/${n}}$.`,
      solution: [
        { math: md`${T}(${P} x^{1/${n}}) = ${T} ${P} + ${T} x^{1/${n}}`, note: "Rational exponent, then the product rule." },
        { math: md`= ${j} + \frac{1}{${n}}${T} x`, note: "The power rule works for fractional powers too." },
        { math: md`(p, q) = \left(${j}, \frac{1}{${n}}\right)`, note: "" },
      ],
    };
  }
  if (kind === 3) {
    const jj = r.int(1, 4);
    const quotient = r.next() < 0.5;
    const p = quotient ? -jj : jj;
    const eTex = jj === 1 ? "e" : `e^{${jj}}`;
    const inside = quotient ? `\\frac{x^{${k}}}{${eTex}}` : `${eTex}x^{${k}}`;
    const typed = (x: number) => (quotient ? `${x}^${k} / e^${jj}` : `e^${jj} * ${x}^${k}`);
    return {
      prompt: md`Write $\ln ${quotient ? inside : `(${inside})`}$ in the form $p + q\ln x$, for $x > 0$. Give $(p, q)$.`,
      answer: `(${p}, ${k})`,
      form: "tuple",
      verify: [`ln(${typed(2)}) = p + q*ln(2)`, `ln(${typed(7)}) = p + q*ln(7)`],
      hint: md`$\ln ${eTex} = ${jj}$, and the power rule handles $x^{${k}}$.`,
      solution: [
        { math: quotient ? md`\ln x^{${k}} - \ln ${eTex}` : md`\ln ${eTex} + \ln x^{${k}}`, note: quotient ? "Quotient rule." : "Product rule." },
        { math: quotient ? md`${k}\ln x - ${jj}` : md`${jj} + ${k}\ln x`, note: md`$\ln ${eTex} = ${jj}$ and $\ln x^{${k}} = ${k}\ln x$.` },
        { math: md`(p, q) = (${p}, ${k})`, note: "" },
      ],
    };
  }
  const m = r.int(1, 3);
  const yTop = r.next() < 0.5;
  const s = yTop ? m : -m;
  const yPow = m === 1 ? "y" : `y^{${m}}`;
  const inside = yTop ? `\\frac{x^{${k}}${yPow}}{${P}}` : `\\frac{${P}x^{${k}}}{${yPow}}`;
  const p = yTop ? -j : j;
  const typed = (x: number, y: number) => (yTop ? `${x}^${k} * ${y}^${m} / ${P}` : `${P} * ${x}^${k} / ${y}^${m}`);
  return {
    prompt: md`Write $${T} ${inside}$ in the form $p + q${T} x + s${T} y$, for $x, y > 0$. Give $(p, q, s)$.`,
    answer: `(${p}, ${k}, ${s})`,
    form: "tuple",
    // The identity holds for all x, y > 0; three generic points pin down p, q and s.
    verify: [
      `${t}(${typed(2, 3)}) = p + q*${t}(2) + s*${t}(3)`,
      `${t}(${typed(3, 2)}) = p + q*${t}(3) + s*${t}(2)`,
      `${t}(${typed(5, 7)}) = p + q*${t}(5) + s*${t}(7)`,
    ],
    hint: "Top factors become added logs, bottom factors become subtracted logs. Then use the power rule.",
    solution: [
      {
        math: yTop ? md`${T} x^{${k}} + ${T} ${yPow} - ${T} ${P}` : md`${T} ${P} + ${T} x^{${k}} - ${T} ${yPow}`,
        note: "Product rule for the top, quotient rule for the bottom.",
      },
      { math: yTop ? md`${k}${T} x + ${m === 1 ? "" : m}${T} y - ${j}` : md`${j} + ${k}${T} x - ${m === 1 ? "" : m}${T} y`, note: md`Power rule, and $${T} ${P} = ${j}$.` },
      { math: md`(p, q, s) = (${p}, ${k}, ${s})`, note: "" },
    ],
  };
};

const condenseAndChange: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const b = r.pick([2, 3, 5, 10, "e"] as const);
    const T = L(b);
    const t = Lt(b);
    const c = r.int(2, 3);
    const m = r.int(2, c === 2 ? 6 : 4);
    const n = r.pick([2, 3, 5, 7].filter((v) => v !== m));
    const plus = r.next() < 0.5;
    const ans = plus ? String(m ** c * n) : frac(m ** c, n);
    return {
      prompt: md`Write $${c}${T} ${m} ${plus ? "+" : "-"} ${T} ${n}$ as a single logarithm $${T} N$. Find $N$.`,
      answer: ans,
      verify: [`${t}(N) = ${c}*${t}(${m}) ${plus ? "+" : "-"} ${t}(${n})`],
      hint: md`Power rule first, so the coefficient ${c} becomes an exponent. Then the ${plus ? "product" : "quotient"} rule.`,
      solution: [
        { math: md`${c}${T} ${m} = ${T} ${m}^{${c}} = ${T} ${m ** c}`, note: "Power rule, run backwards." },
        { math: md`${T} ${m ** c} ${plus ? "+" : "-"} ${T} ${n} = ${T} ${plus ? `(${m ** c} \\cdot ${n})` : `\\frac{${m ** c}}{${n}}`}`, note: plus ? "A sum of logs is the log of a product." : "A difference of logs is the log of a quotient." },
        { math: md`N = ${plus ? ans : fracTex(m ** c, n)}`, note: "" },
      ],
    };
  }
  if (kind === 1 || kind === 2) {
    const b = r.pick([2, 3, 5, 10]);
    const T = L(b);
    const m = r.int(2, 7);
    let n = r.int(2, 5);
    while (n === m) n = r.int(2, 5);
    const plus = kind === 1;
    const ans = plus ? String(m * n * n) : frac(m * m, n);
    return {
      prompt: plus ? md`Solve $${T} x = ${T} ${m} + 2${T} ${n}$.` : md`Solve $${T} x = 2${T} ${m} - ${T} ${n}$. Give an exact answer.`,
      answer: ans,
      hint: "Condense the right side into a single logarithm. Then two equal logs (same base) have equal insides.",
      solution: [
        plus
          ? { math: md`${T} x = ${T} ${m} + ${T} ${n * n} = ${T} ${m * n * n}`, note: md`Power rule: $2${T} ${n} = ${T} ${n * n}$. Then the product rule.` }
          : { math: md`${T} x = ${T} ${m * m} - ${T} ${n} = ${T} \frac{${m * m}}{${n}}`, note: md`Power rule: $2${T} ${m} = ${T} ${m * m}$. Then the quotient rule.` },
        { math: md`x = ${plus ? ans : fracTex(m * m, n)}`, note: md`$\log_b$ is one-to-one: equal logs come from equal inputs.` },
      ],
    };
  }
  for (;;) {
    const b = r.pick([2, 3, 5, 6, 7]);
    const N = r.int(3, 60);
    if (isPowerOf(N, b)) continue;
    const v = Math.log(N) / Math.log(b);
    const key = rounded(v, 3);
    if (!key) continue;
    const lo = Math.floor(v);
    return {
      prompt: md`Approximate $${L(b)} ${N}$ using the change-of-base formula. ${ROUND3}`,
      answer: key,
      hint: md`$\log_b x = \frac{\ln x}{\ln b}$. Your calculator has $\ln$.`,
      solution: [
        { math: md`${L(b)} ${N} = \frac{\ln ${N}}{\ln ${b}}`, note: "Change of base." },
        { math: md`\approx \frac{${Math.log(N).toFixed(5)}}{${Math.log(b).toFixed(5)}} \approx ${key}`, note: md`Sense check: $${b}^{${lo}} = ${b ** lo}$ and $${b}^{${lo + 1}} = ${b ** (lo + 1)}$, and ${N} is between them, so the answer is between ${lo} and ${lo + 1}.` },
      ],
    };
  }
};

// ── Lesson 5: Solving exponential equations ─────────────────────────────────

/** An exponent like 2x - 1, ready for LaTeX. */
const lin = (a: number, c: number) => poly([[a, "x"], [c, ""]]);

const sameBase: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const c = r.pick([2, 3, 5]);
    const m = c === 5 ? 2 : r.int(2, 3);
    const maxN = c === 2 ? 7 : c === 3 ? 5 : 3;
    let n = r.int(1, maxN);
    while (n % m === 0) n = r.int(1, maxN);
    const recip = r.next() < 0.3;
    const rhs = recip ? `\\frac{1}{${c ** n}}` : String(c ** n);
    const e = recip ? -n : n;
    return {
      prompt: md`Solve $${c ** m}^{x} = ${rhs}$. Give an exact answer.`,
      answer: frac(e, m),
      hint: md`Write both sides as powers of ${c}.`,
      solution: [
        { math: md`(${c}^{${m}})^{x} = ${c}^{${e}}`, note: md`$${c ** m} = ${c}^{${m}}$ and $${rhs} = ${c}^{${e}}$.` },
        { math: md`${c}^{${m}x} = ${c}^{${e}}`, note: "Power rule." },
        { math: md`${m}x = ${e} \;\Rightarrow\; x = ${fracTex(e, m)}`, note: "Same base, so the exponents are equal: exponential functions are one-to-one." },
      ],
    };
  }
  if (kind === 1) {
    const c = r.pick([2, 3]);
    const m1 = r.int(1, 2);
    const a = r.int(1, 3);
    const p = r.nonzero(-4, 4);
    const n = r.int(1, c === 2 ? 6 : 4);
    const B = c ** m1;
    const x = frac(n - m1 * p, m1 * a);
    return {
      prompt: md`Solve $${B}^{${lin(a, p)}} = ${c ** n}$. Give an exact answer.`,
      answer: x,
      hint: md`Write ${m1 === 1 ? `${c ** n} as a power` : `${c ** n} and ${B} as powers`} of ${c}, then set the exponents equal.`,
      solution: [
        { math: m1 === 1 ? md`${c}^{${lin(a, p)}} = ${c}^{${n}}` : md`${c}^{${m1}(${lin(a, p)})} = ${c}^{${n}}`, note: md`$${c ** n} = ${c}^{${n}}$${m1 === 1 ? "" : md` and $${B} = ${c}^{${m1}}$`}.` },
        { math: md`${m1 === 1 ? lin(a, p) : `${m1}(${lin(a, p)})`} = ${n}`, note: "Same base, equal exponents." },
        { math: md`x = ${fracTex(n - m1 * p, m1 * a)}`, note: "Solve the linear equation." },
      ],
    };
  }
  if (kind === 2) {
    const c = r.pick([2, 3]);
    const [m, n] = r.pick([
      [1, 2],
      [2, 1],
      [1, 3],
      [3, 1],
      [2, 3],
      [3, 2],
    ] as const);
    let p = r.int(-3, 3);
    const q = r.int(-3, 3);
    if (p === q) p = q + 1;
    const ans = frac(n * q - m * p, m - n);
    const left = c ** m;
    const right = c ** n;
    const ex1 = lin(1, p);
    const ex2 = lin(1, q);
    return {
      prompt: md`Solve $${left}^{${ex1}} = ${right}^{${ex2}}$. Give an exact answer.`,
      answer: ans,
      hint: md`Both ${left} and ${right} are powers of ${c}.`,
      solution: [
        { math: md`${c}^{${m === 1 ? ex1 : `${m}(${ex1})`}} = ${c}^{${n === 1 ? ex2 : `${n}(${ex2})`}}`, note: md`$${left} = ${c}^{${m}}$ and $${right} = ${c}^{${n}}$; power rule on each side.` },
        { math: md`${lin(m, m * p)} = ${lin(n, n * q)}`, note: "Equal exponents, then distribute." },
        { math: md`x = ${fracTex(n * q - m * p, m - n)}`, note: "Collect the x-terms on one side." },
      ],
    };
  }
  const useE = r.next() < 0.3;
  if (useE) {
    const p = r.int(2, 5);
    let s = r.int(1, 4);
    if (s === p) s = p - 1;
    const q = r.int(-6, 6);
    const tt = r.int(-6, 6);
    return {
      prompt: md`Solve $e^{${lin(p, q)}} = e^{${lin(s, tt)}}$. Give an exact answer.`,
      answer: frac(tt - q, p - s),
      hint: "Same base e on both sides, so set the exponents equal.",
      solution: [
        { math: md`${lin(p, q)} = ${lin(s, tt)}`, note: md`$e^x$ is one-to-one, like every exponential.` },
        { math: p - s === 1 ? md`x = ${tt - q}` : md`${poly([[p - s, "x"]])} = ${tt - q} \;\Rightarrow\; x = ${fracTex(tt - q, p - s)}`, note: "Collect the x-terms on one side." },
      ],
    };
  }
  const b = r.pick([2, 3, 5]);
  const k = r.int(1, b === 2 ? 5 : 3);
  const a = r.int(2, 5);
  const d = r.nonzero(-9, 9);
  const E = a * b ** k + d;
  return {
    prompt: md`Solve $${a} \cdot ${b}^{x} ${signed(d)} = ${E}$.`,
    answer: String(k),
    hint: md`Isolate the power $${b}^{x}$ first, the way you'd isolate $x$ in a linear equation.`,
    solution: [
      { math: md`${a} \cdot ${b}^{x} = ${E - d}`, note: md`${d > 0 ? "Subtract" : "Add"} ${Math.abs(d)}.` },
      { math: md`${b}^{x} = ${b ** k}`, note: md`Divide by ${a}. Not $${a * b}^{x}$: the ${a} isn't part of the base.` },
      { math: md`${b}^{x} = ${b}^{${k}} \;\Rightarrow\; x = ${k}`, note: "Same base, equal exponents." },
    ],
  };
};

const PRIMES = [2, 3, 5, 7];

const takeLogs: Generator = (r) => {
  const kind = r.int(0, 5);
  if (kind === 0 || kind === 1) {
    const b = r.pick(PRIMES);
    let M = r.int(2, 40);
    while (isPowerOf(M, b)) M = r.int(2, 40);
    const isolate = kind === 1;
    const a = r.int(2, 6);
    const d = r.int(-9, 9);
    const lhs = isolate ? `${a} \\cdot ${b}^{x} ${d === 0 ? "" : signed(d)}` : `${b}^{x}`;
    const rhs = isolate ? a * M + d : M;
    const steps: Step[] = [];
    if (isolate) steps.push({ math: md`${b}^{x} = ${M}`, note: md`${d === 0 ? "" : `${d > 0 ? "Subtract" : "Add"} ${Math.abs(d)}, then d`}${d === 0 ? "D" : ""}ivide by ${a}. Isolate the power before taking logs.` });
    steps.push(
      { math: md`\ln ${b}^{x} = \ln ${M}`, note: md`${M} isn't a power of ${b}, so take $\ln$ of both sides: equal numbers have equal logarithms.` },
      { math: md`x\ln ${b} = \ln ${M}`, note: "The power rule brings the exponent down." },
      { math: md`x = \frac{\ln ${M}}{\ln ${b}} \approx ${(Math.log(M) / Math.log(b)).toFixed(3)}`, note: md`Divide by $\ln ${b}$, which isn't 0. This is also $\log_{${b}} ${M}$.` },
    );
    return {
      prompt: md`Solve $${lhs} = ${rhs}$. ${EXACT_LOG}`,
      answer: `ln(${M})/ln(${b})`,
      hint: isolate ? md`Get $${b}^{x}$ alone first. Then take the logarithm of both sides.` : md`Take $\ln$ of both sides and use the power rule.`,
      solution: steps,
    };
  }
  if (kind === 2) {
    const k = r.int(2, 5);
    const a = r.int(1, 4);
    let M = r.int(2, 20);
    while (M === 1) M = r.int(2, 20);
    const N = a * M;
    const lhs = a === 1 ? `e^{${k}x}` : `${a}e^{${k}x}`;
    return {
      prompt: md`Solve $${lhs} = ${N}$. ${EXACT_LOG}`,
      answer: `ln(${M})/${k}`,
      hint: md`${a === 1 ? "" : `Divide by ${a} first. `}Then take $\ln$ of both sides: $\ln e^{u} = u$.`,
      solution: [
        ...(a === 1 ? [] : [{ math: md`e^{${k}x} = ${M}`, note: md`Divide by ${a}.` }]),
        { math: md`${k}x = \ln ${M}`, note: md`$\ln$ undoes $e^{x}$.` },
        { math: md`x = \frac{\ln ${M}}{${k}} \approx ${(Math.log(M) / k).toFixed(3)}`, note: md`Divide by ${k}.` },
      ],
    };
  }
  if (kind === 3) {
    const p = r.pick([2, 3, 5]);
    const q = r.pick(PRIMES.filter((v) => v !== p));
    const s = r.pick([1, 2, -1]);
    const sTex = s === 1 ? "" : s === -1 ? "-" : String(s);
    const exL = s === 1 ? "x + 1" : s === -1 ? "x - 1" : `x + ${s}`;
    const ans = `${s === 1 ? "" : s === -1 ? "-" : s}ln(${p})/(ln(${q}) - ln(${p}))`;
    return {
      prompt: md`Solve $${p}^{${exL}} = ${q}^{x}$. ${EXACT_LOG}`,
      answer: ans,
      hint: md`Take $\ln$ of both sides, bring the exponents down, then collect the $x$-terms.`,
      solution: [
        { math: md`(${exL})\ln ${p} = x\ln ${q}`, note: "Take ln of both sides; power rule on each side." },
        { math: md`x\ln ${p} ${s < 0 ? "-" : "+"} ${Math.abs(s) === 1 ? "" : Math.abs(s)}\ln ${p} = x\ln ${q}`, note: md`Distribute. $\ln ${p}$ is just a number.` },
        { math: md`${sTex}\ln ${p} = x(\ln ${q} - \ln ${p})`, note: "Collect the x-terms and factor out x." },
        { math: md`x = \frac{${sTex}\ln ${p}}{\ln ${q} - \ln ${p}} \approx ${((s * Math.log(p)) / (Math.log(q) - Math.log(p))).toFixed(3)}`, note: md`Divide. $\ln ${q} - \ln ${p} \ne 0$ since ${q} isn't ${p}.` },
      ],
    };
  }
  if (kind === 4) {
    const P = r.pick([500, 1000, 2000, 5000]);
    const rate = r.pick([2, 4, 5, 8, 10]);
    const k = r.pick([2, 3, 4]);
    const rr = num(rate / 100);
    const word = k === 2 ? "double" : k === 3 ? "triple" : "quadruple";
    return {
      prompt: md`An investment of ${P} dollars grows at ${rate}% a year, compounded continuously. After how many years will it ${word}? ${EXACT_LOG}`,
      answer: `ln(${k})/${rr}`,
      verify: [`${P}e^(${rr}t) = ${k * P}`],
      hint: md`Set $${P}e^{${rr}t} = ${k * P}$. Divide by ${P}, then take $\ln$.`,
      solution: [
        { math: md`${P}e^{${rr}t} = ${k * P}`, note: md`To ${word} is to reach ${k} times the start.` },
        { math: md`e^{${rr}t} = ${k}`, note: md`Divide by ${P}. The starting amount doesn't matter, only the factor ${k}.` },
        { math: md`${rr}t = \ln ${k} \;\Rightarrow\; t = \frac{\ln ${k}}{${rr}}`, note: "Take ln of both sides." },
        { math: md`t \approx ${(Math.log(k) / (rate / 100)).toFixed(2)} \text{ years}`, note: "" },
      ],
    };
  }
  for (;;) {
    const b = r.pick([2, 3, 5, 7]);
    const N = r.int(3, 60);
    if (isPowerOf(N, b)) continue;
    const v = Math.log(N) / Math.log(b);
    const key = rounded(v, 3);
    if (!key) continue;
    return {
      prompt: md`Approximate the solution of $${b}^{x} = ${N}$. ${ROUND3}`,
      answer: key,
      hint: md`Take $\ln$ of both sides, solve for $x$, then use a calculator.`,
      solution: [
        { math: md`x\ln ${b} = \ln ${N}`, note: "Take ln of both sides; power rule." },
        { math: md`x = \frac{\ln ${N}}{\ln ${b}} \approx ${key}`, note: md`Check: $${b}^{${key}}$ is about ${(b ** Number(key)).toFixed(2)}.` },
      ],
    };
  }
};

/** [b, m, p, q]: log_b(x) + log_b(x - (p + q)) = m has roots p > 0 and q < 0, with pq = -b^m. */
const SUM_CASES: [number, number, number, number][] = [];
for (const [b, mMax] of [
  [2, 5],
  [3, 3],
  [5, 2],
  [6, 2],
  [10, 1],
] as const) {
  for (let m = 1; m <= mMax; m++) {
    const N = b ** m;
    for (let s = 1; s * s < N; s++) if (N % s === 0) SUM_CASES.push([b, m, N / s, -s]);
  }
}

const logEquations: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const [b, m, p, q] = r.pick(SUM_CASES);
    const k = p + q;
    const sh = r.int(-3, 3);
    const A = lin(1, -sh);
    const Bx = lin(1, -(sh + k));
    const [x1, x2] = [p + sh, q + sh];
    const B = -(x1 + x2);
    const C = x1 * x2;
    return {
      prompt: md`Solve $${L(b)}${sh === 0 ? " x" : `(${A})`} + ${L(b)}(${Bx}) = ${m}$. ${SOLS}`,
      answer: String(x1),
      form: "set",
      hint: "Combine the logs with the product rule, rewrite in exponential form, then check each candidate in the original equation.",
      solution: [
        { math: md`${L(b)}\left[${sh === 0 ? "x" : `(${A})`}(${Bx})\right] = ${m}`, note: "Product rule." },
        { math: md`${sh === 0 ? "x" : `(${A})`}(${Bx}) = ${b ** m}`, note: "Exponential form." },
        { math: md`${poly([[1, "x^2"], [B, "x"], [C, ""]])} = 0`, note: md`Expand and subtract ${b ** m}.` },
        { math: md`(${lin(1, -x1)})(${lin(1, -x2)}) = 0 \;\Rightarrow\; x = ${x1} \text{ or } x = ${x2}`, note: "Factor." },
        { math: md`x = ${x2}: \; ${sh === 0 ? "x" : A} = ${x2 - sh} < 0`, note: md`The logarithm of a negative number doesn't exist, so $x = ${x2}$ is extraneous. Combining the logs allowed it in: the product of two negatives is positive.` },
        { math: md`x = ${x1}`, note: md`Check: $${L(b)} ${x1 - sh} + ${L(b)} ${x1 - sh - k} = ${L(b)} ${b ** m} = ${m}$.` },
      ],
    };
  }
  if (kind === 1) {
    const [b, m] = r.pick([
      [2, 1],
      [2, 2],
      [3, 1],
      [3, 2],
      [4, 1],
      [5, 1],
    ] as const);
    const j = r.int(1, 3);
    const P = b ** m;
    const k = j * (P - 1);
    const x = j * P;
    return {
      prompt: md`Solve $${L(b)} x - ${L(b)}(x - ${k}) = ${m}$. ${SOLS}`,
      answer: String(x),
      form: "set",
      hint: "Quotient rule, then exponential form, then clear the fraction.",
      solution: [
        { math: md`${L(b)} \frac{x}{x - ${k}} = ${m}`, note: "Quotient rule." },
        { math: md`\frac{x}{x - ${k}} = ${P}`, note: "Exponential form." },
        { math: md`x = ${P}x - ${P * k} \;\Rightarrow\; ${P * k} = ${P - 1 === 1 ? "" : P - 1}x`, note: md`Multiply by $x - ${k}$.` },
        { math: md`x = ${x}`, note: md`Check: $x = ${x}$ and $x - ${k} = ${j}$ are both positive, so both logs exist.` },
      ],
    };
  }
  if (kind === 2) {
    const b = r.pick([2, 3, 5, 10, "e"] as const);
    const a = r.int(2, 5);
    let d = r.int(1, 5);
    while (d === a) d = r.int(1, 5);
    const x0 = r.int(1, 6);
    const v = r.int(1, 12);
    const c = v - a * x0;
    const e = v - d * x0;
    return {
      prompt: md`Solve $${L(b)}(${lin(a, c)}) = ${L(b)}(${lin(d, e)})$. ${SOLS}`,
      answer: String(x0),
      form: "set",
      hint: "Same base on both sides: the insides must be equal.",
      solution: [
        { math: md`${lin(a, c)} = ${lin(d, e)}`, note: "A logarithm is one-to-one, so equal logs have equal insides." },
        { math: a - d === 1 ? md`x = ${x0}` : md`${poly([[a - d, "x"]])} = ${e - c} \;\Rightarrow\; x = ${x0}`, note: "" },
        { math: md`${a}(${x0})${c === 0 ? "" : ` ${signed(c)}`} = ${v} > 0`, note: md`Check: both insides equal ${v}, which is positive, so $x = ${x0}$ is a real solution.` },
      ],
    };
  }
  if (kind === 3) {
    const b = r.pick([2, 3, 10]);
    const s = r.int(1, 4);
    const root = s + r.int(1, 5);
    const k = root - s;
    const c = root * s;
    const kx = k === 1 ? "x" : `${k}x`;
    return {
      prompt: md`Solve $${L(b)}(x^{2} - ${c}) = ${L(b)}(${kx})$. ${SOLS}`,
      answer: String(root),
      form: "set",
      hint: "Set the insides equal, solve the quadratic, then check each candidate in the original logs.",
      solution: [
        { math: md`x^{2} - ${c} = ${kx}`, note: "Equal logs, equal insides." },
        { math: md`${poly([[1, "x^2"], [-k, "x"], [-c, ""]])} = 0 \;\Rightarrow\; (x - ${root})(x + ${s}) = 0`, note: "Factor (Algebra 1, Unit 7)." },
        { math: md`x = -${s}: \; ${k === 1 ? "" : k}(-${s}) = ${-k * s} < 0`, note: md`$${L(b)}(${-k * s})$ doesn't exist, so $x = -${s}$ is extraneous.` },
        { math: md`x = ${root}`, note: md`Check: $${root}^2 - ${c} = ${root * root - c}$ and $${k === 1 ? "" : `${k} \\cdot `}${root} = ${k * root}$. Equal and positive.` },
      ],
    };
  }
  const p = r.int(1, 6);
  const k = r.int(1, 5);
  const N = p * (p + k);
  return {
    prompt: md`Solve $\ln x + \ln(x + ${k}) = \ln ${N}$. ${SOLS}`,
    answer: String(p),
    form: "set",
    hint: md`Combine the left side into one logarithm, then set the insides equal.`,
    solution: [
      { math: md`\ln[x(x + ${k})] = \ln ${N}`, note: "Product rule." },
      { math: md`x^{2} + ${k === 1 ? "" : k}x - ${N} = 0 \;\Rightarrow\; (x - ${p})(x + ${p + k}) = 0`, note: "Equal insides, then factor." },
      { math: md`x = -${p + k}: \; \ln(-${p + k}) \text{ is undefined}`, note: md`So $x = -${p + k}$ is extraneous.` },
      { math: md`x = ${p}`, note: md`Check: $\ln ${p} + \ln ${p + k} = \ln ${N}$.` },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit6: Unit = {
  title: "Exponential and Logarithmic Functions",
  lessons: [
    {
      id: "exponential-growth-and-decay",
      title: "Exponential growth and decay",
      summary: "Functions that multiply by the same factor at every step: growth, decay, percent change and half-life.",
      blocks: [
        {
          kind: "text",
          body: md`A linear function adds the same amount at every step. In Algebra 1, Unit 4, $y = 3x + 2$ climbed by 3 each time $x$ went up by 1. Plenty of things don't grow like that. A bank balance, a rumor or a colony of bacteria grows by an amount that depends on how much is already there.

That kind of change **multiplies** by the same factor at every step. Start with 3 bacteria that double every hour:

$$\begin{array}{c|ccccc} \text{hours } x & 0 & 1 & 2 & 3 & 4 \\ \hline \text{bacteria } y & 3 & 6 & 12 & 24 & 48 \end{array}$$

After $x$ hours there have been $x$ doublings, so $y = 3 \cdot 2^{x}$. The variable has moved into the exponent.`,
        },
        {
          kind: "key",
          title: "Exponential function",
          body: md`An **exponential function** has the form

$$f(x) = a \cdot b^{x}, \qquad a \ne 0,\quad b > 0,\quad b \ne 1.$$

- $a$ is the **initial value**: $f(0) = a \cdot b^0 = a$.
- $b$ is the **growth factor**: each step of 1 in $x$ multiplies the output by $b$.
- $b > 1$ is **growth**. $0 < b < 1$ is **decay**.

Don't confuse it with $x^2$. There the variable is the base and the exponent is fixed. Here the base is fixed and the variable is the exponent.`,
        },
        {
          kind: "proof",
          title: "Equal steps multiply by the same factor",
          given: md`$f(x) = a \cdot b^{x}$ and any step size $h$`,
          prove: md`$f(x + h) = b^{h} \cdot f(x)$ for every $x$`,
          steps: [
            { statement: md`$f(x + h) = a \cdot b^{x + h}$`, reason: md`Definition of $f$` },
            { statement: md`$= a \cdot b^{x} \cdot b^{h}$`, reason: md`Product rule $b^m b^n = b^{m + n}$ (Algebra 1, Unit 6), read right to left` },
            { statement: md`$= b^{h} \cdot (a \cdot b^{x})$`, reason: "Commutative and associative properties" },
            { statement: md`$= b^{h} \cdot f(x)$`, reason: md`Definition of $f$` },
          ],
        },
        {
          kind: "why",
          title: "Why this is the fingerprint of exponential growth",
          body: md`With $h = 1$ the proof says $f(x + 1) = b \cdot f(x)$: each step multiplies by $b$. So in a table with equally spaced inputs, the **ratios** of consecutive outputs are all equal. In the table above, $\frac{6}{3} = \frac{12}{6} = \frac{24}{12} = 2$.

A linear function has equal *differences*. An exponential function has equal *ratios*. To test a table, subtract neighbors and divide neighbors, and see which one stays constant.`,
        },
        {
          kind: "why",
          title: "Why the base must be positive and not 1",
          body: md`If $b = 1$, then $1^{x} = 1$ for every $x$. Nothing grows; the graph is a flat line. If $b$ were negative, say $b = -4$, then $(-4)^{1/2} = \sqrt{-4}$ isn't a real number, so $f$ would have holes at $x = \frac12$ and at infinitely many other inputs.

A positive base avoids both problems. Rational exponents (Unit 5) give $b^{x}$ a value for every fraction $x$, and every value is positive. For an irrational exponent like $\sqrt{2}$, the powers $2^{1.4}, 2^{1.41}, 2^{1.414}, \ldots$ settle down to a single number, and that number is what $2^{\sqrt2}$ means.`,
        },
        {
          kind: "plot",
          x: [-4, 4],
          y: [-1, 13],
          curves: [{ expr: "a*b^x", label: "y = a \\cdot b^x" }],
          points: [
            { x: 0, y: "a", label: "(0, {a})", color: 2 },
            { x: 1, y: "a*b", label: "(1, {=a*b})", color: 3 },
          ],
          params: [
            { name: "a", min: 0.5, max: 4, step: 0.5, value: 1 },
            { name: "b", min: 0.25, max: 3, step: 0.25, value: 2 },
          ],
          caption: md`Slide $b$. Above 1 the curve rises; below 1 it falls; at exactly 1 it's flat. The point $(0, a)$ doesn't move when $b$ changes, because $b^0 = 1$ for every base. And the curve never touches the $x$-axis.`,
        },
        {
          kind: "why",
          title: "Why the graph never reaches zero",
          body: md`Going right, each step multiplies by $b$, and a positive number times a positive number is never 0. Going left, negative exponents are reciprocals, $b^{-x} = \frac{1}{b^{x}}$, so the values shrink toward 0 without arriving. The $x$-axis is a horizontal asymptote, in the sense of Unit 4, and for $a > 0$ the range is $(0, \infty)$.

Decay is growth seen in a mirror: $\left(\frac12\right)^{x} = \frac{1}{2^{x}} = 2^{-x}$. Replacing $x$ with $-x$ reflects a graph across the $y$-axis (Unit 1), so the graph of $\left(\frac12\right)^{x}$ is the graph of $2^{x}$ flipped left to right.`,
        },
        {
          kind: "key",
          title: "Percent change",
          body: md`A quantity that grows by a rate $r$ each period (as a decimal, so 6% is $r = 0.06$) is multiplied by $1 + r$ each period. One that shrinks by $r$ is multiplied by $1 - r$:

$$\text{growth: } y = a(1 + r)^{t} \qquad\qquad \text{decay: } y = a(1 - r)^{t}$$`,
        },
        {
          kind: "why",
          title: "Why 6% more means times 1.06",
          body: md`Adding 6% of an amount $A$ gives $A + 0.06A$. Factor out $A$, the distributive property run backwards: $A + 0.06A = A(1 + 0.06) = 1.06A$. So a 6% increase is a single multiplication. Repeat it every year and the multiplications stack up into a power.

This explains a classic surprise. A 20% drop followed by a 20% rise multiplies by $0.8 \cdot 1.2 = 0.96$. You end up 4% *below* where you started, because the rise was 20% of a smaller amount.`,
        },
        {
          kind: "example",
          title: "Percent growth",
          problem: md`A town of 5000 people grows by 4% a year. What is its population after 3 years?`,
          steps: [
            { math: md`P(t) = 5000(1.04)^{t}`, note: md`Initial value 5000, growth factor $1 + 0.04$.` },
            { math: md`P(3) = 5000(1.04)^{3} = 5000(1.124864)`, note: "Three years, three multiplications by 1.04." },
            { math: md`P(3) = 5624.32 \approx 5624`, note: md`A linear model adding 4% of 5000, which is 200 a year, would predict 5600. The exponential model also grows on its growth.` },
          ],
        },
        {
          kind: "key",
          title: "Doubling time and half-life",
          body: md`If a quantity doubles every $d$ time units, then after time $t$

$$A = A_0 \cdot 2^{t/d}.$$

If it halves every $h$ time units (its **half-life**), then

$$A = A_0 \left(\tfrac{1}{2}\right)^{t/h}.$$

The exponent $\frac{t}{d}$ or $\frac{t}{h}$ counts how many doublings or halvings have happened. After 12 hours with $d = 3$, that's 4 doublings: a factor of $2^4 = 16$. Between whole periods it still makes sense: half a period multiplies by $2^{1/2} = \sqrt2$, because two half-periods must make one doubling, and $\sqrt2 \cdot \sqrt2 = 2$.`,
        },
        {
          kind: "example",
          title: "Half-life",
          problem: md`A medicine has a half-life of 6 hours. A patient takes 80 mg. How much is left after 18 hours?`,
          steps: [
            { math: md`A = 80\left(\tfrac12\right)^{t/6}`, note: "Start at 80, halve every 6 hours." },
            { math: md`A = 80\left(\tfrac12\right)^{18/6} = 80\left(\tfrac12\right)^{3}`, note: "18 hours is 3 half-lives." },
            { math: md`A = \frac{80}{8} = 10 \text{ mg}`, note: "80, 40, 20, 10." },
          ],
        },
        {
          kind: "example",
          title: "Finding the function from two points",
          problem: md`An exponential function $y = ab^{x}$ passes through $(1, 6)$ and $(3, 54)$. Find $a$ and $b$.`,
          steps: [
            { math: md`ab = 6, \qquad ab^{3} = 54`, note: md`Each point satisfies $y = ab^{x}$.` },
            { math: md`\frac{ab^{3}}{ab} = \frac{54}{6} \;\Rightarrow\; b^{2} = 9`, note: md`Divide the equations. The $a$'s cancel, which is the whole point of dividing.` },
            { math: md`b = 3`, note: md`The base of an exponential is positive, so not $-3$.` },
            { math: md`a = \frac{6}{3} = 2 \;\Rightarrow\; y = 2 \cdot 3^{x}`, note: md`Check: $2 \cdot 3^3 = 54$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`A town's population shrinks by 5% each year. By what number is it multiplied each year? Give a decimal.`,
          answer: "0.95",
          explain: md`Losing 5% of $A$ leaves $A - 0.05A = 0.95A$.`,
        },
        {
          kind: "check",
          prompt: md`Let $f(x) = 3 \cdot 2^{x}$. Find $f(4)$.`,
          answer: "48",
          explain: md`Exponent first: $2^4 = 16$, then $3 \cdot 16 = 48$. Not $6^4$: the 3 isn't part of the base.`,
        },
      ],
      practice: [evaluateExponential, growthModels, findModel],
    },
    {
      id: "the-number-e",
      title: "The number e",
      summary: "Compounding interest more and more often leads to a new constant, e, and to continuous growth A = Peʳᵗ.",
      blocks: [
        {
          kind: "text",
          body: md`A bank pays interest as a percent of your balance. If it adds the interest once a year, your money follows the growth model from the last lesson: multiply by $1 + r$ every year. Most banks add interest more often, and each payment of interest starts earning interest of its own. That is **compounding**.`,
        },
        {
          kind: "why",
          title: "Where the compound interest formula comes from",
          body: md`Say the yearly rate is $r$ and interest is paid $n$ times a year. Each payment is the fraction $\frac{r}{n}$ of the balance: 6% a year paid monthly is $\frac{0.06}{12} = 0.005$, or 0.5%, each month.

Adding $\frac{r}{n}$ of the balance multiplies it by $1 + \frac{r}{n}$, for the same reason 6% more means times 1.06. In $t$ years there are $nt$ payments, so the deposit is multiplied by $1 + \frac{r}{n}$ a total of $nt$ times.`,
        },
        {
          kind: "key",
          title: "Compound interest",
          body: md`A deposit $P$ at yearly rate $r$, compounded $n$ times a year, grows in $t$ years to

$$A = P\left(1 + \frac{r}{n}\right)^{nt}.$$`,
        },
        {
          kind: "example",
          title: "Monthly compounding",
          problem: md`You deposit 1000 dollars at 6% a year, compounded monthly. How much do you have after 2 years?`,
          steps: [
            { math: md`A = 1000\left(1 + \frac{0.06}{12}\right)^{12 \cdot 2}`, note: md`$P = 1000$, $r = 0.06$, $n = 12$, $t = 2$.` },
            { math: md`A = 1000(1.005)^{24}`, note: "24 monthly payments of 0.5%." },
            { math: md`A \approx 1127.16`, note: "Compounded once a year it would be 1123.60. The extra 3.56 dollars comes from interest paid during the year starting to earn interest of its own straight away." },
          ],
        },
        {
          kind: "text",
          body: md`So more payments mean more money. How far does that go? Take the simplest case: 1 dollar at 100% interest for one year, so $P = 1$, $r = 1$ and $A = \left(1 + \frac1n\right)^{n}$. Paid once, 1 dollar becomes 2. Paid twice, $\left(1 + \frac12\right)^2 = 2.25$. Here is what happens as $n$ grows:

$$\begin{array}{r|l} n & \left(1 + \frac{1}{n}\right)^{n} \\ \hline 1 & 2 \\ 2 & 2.25 \\ 4 & 2.44140\ldots \\ 12 & 2.61303\ldots \\ 365 & 2.71456\ldots \\ 1000 & 2.71692\ldots \\ 1\,000\,000 & 2.71828\ldots \end{array}$$

The values keep rising, but by less and less. They are closing in on one particular number.`,
        },
        {
          kind: "key",
          title: "The number e",
          body: md`$$e = \lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^{n} = 2.718281828\ldots$$

Read "lim" as: $\left(1 + \frac1n\right)^n$ gets as close to $e$ as you like once $n$ is large enough. Like $\pi$, $e$ is irrational: its decimals never end or repeat.

$e$ is a number, so every exponent rule applies to it: $e^{2x} \cdot e^{3x} = e^{5x}$. The function $y = e^{x}$ is often called *the* exponential function. Type it as e^x, or e^(2x) for $e^{2x}$.`,
        },
        {
          kind: "why",
          title: "Why the values level off instead of growing forever",
          body: md`Two effects pull against each other. More payments mean more multiplications, but each multiplier $1 + \frac1n$ is closer to 1. Splitting the year in two earned an extra 0.25. Going from 365 payments to 1000 earns less than a quarter of a cent per dollar. The bonus from each further split shrinks so fast that the total never passes 3.

The table is evidence, not proof. A proof that the values always increase and stay below 3 uses the binomial theorem, which you'll meet in Unit 8.`,
        },
        {
          kind: "why",
          title: "From e to any rate",
          body: md`With yearly rate $r$, compounding $n$ times multiplies a year's balance by $\left(1 + \frac{r}{n}\right)^{n}$. Let $m = \frac{n}{r}$, so $\frac{r}{n} = \frac{1}{m}$ and $n = mr$:

$$\left(1 + \frac{r}{n}\right)^{n} = \left(1 + \frac{1}{m}\right)^{mr} = \left[\left(1 + \frac{1}{m}\right)^{m}\right]^{r}.$$

The last step is the power rule $(x^p)^q = x^{pq}$. As $n$ grows, so does $m$, and the bracket approaches $e$. So compounding without limit multiplies each year by $e^{r}$, and $t$ years multiply by $(e^{r})^{t} = e^{rt}$.`,
        },
        {
          kind: "key",
          title: "Continuous growth",
          body: md`Compounded **continuously** at rate $r$, an amount $P$ grows in time $t$ to

$$A = Pe^{rt}.$$

For continuous decay at rate $r$ (still a positive number, like $r = 0.2$ for 20%), the exponent is negative: $A = Pe^{-rt}$. Losing $\frac{r}{n}$ each period instead of gaining it puts $\left(1 - \frac{1}{m}\right)^{m}$ in the bracket, and that closes in on $\frac{1}{e}$: at $m = 1000$ it is $0.999^{1000} \approx 0.3677$, and $\frac{1}{e} \approx 0.3679$. So each year multiplies by $e^{-r}$.`,
        },
        {
          kind: "plot",
          x: [0, 2.5],
          y: [-0.5, 10],
          curves: [
            { expr: "e^x", label: "y = e^x", color: 3, dashed: true },
            { expr: "(1 + 1/n)^(n x)", label: "y = \\left(1 + \\frac{1}{n}\\right)^{nx}", color: 1 },
          ],
          points: [
            { x: 1, y: "(1 + 1/n)^n", label: "(1, {=(1 + 1/n)^n})", color: 2 },
            { x: 1, y: "e", label: "(1, e)", color: 3 },
          ],
          params: [{ name: "n", min: 1, max: 50, step: 1, value: 1 }],
          caption: md`Slide $n$, the number of payments a year. The solid curve is the balance from 1 dollar at 100% after $x$ years. It sits below $y = e^{x}$, and as $n$ grows it presses up against it but never crosses it: continuous compounding is the ceiling.`,
        },
        {
          kind: "example",
          title: "Continuous compounding",
          problem: md`You invest 500 dollars at 4% a year, compounded continuously. How much do you have after 10 years?`,
          steps: [
            { math: md`A = 500e^{0.04 \cdot 10} = 500e^{0.4}`, note: md`$P = 500$, $r = 0.04$, $t = 10$.` },
            { math: md`A \approx 500(1.4918247) \approx 745.91`, note: md`Calculators have an $e^{x}$ key.` },
          ],
        },
        {
          kind: "example",
          title: "How much does compounding matter?",
          problem: md`Compare 1000 dollars at 6% for 10 years, compounded once a year, monthly, and continuously.`,
          steps: [
            { math: md`1000(1.06)^{10} \approx 1790.85`, note: "Once a year." },
            { math: md`1000(1.005)^{120} \approx 1819.40`, note: "Monthly: 120 payments of 0.5%." },
            { math: md`1000e^{0.6} \approx 1822.12`, note: "Continuously. Only 2.72 dollars more than monthly: most of the gain from compounding is already there by monthly." },
          ],
        },
        {
          kind: "check",
          prompt: md`200 dollars is invested at 5% a year, compounded continuously. Write the amount after $t$ years as an expression in $t$ (type $e^{2t}$ as e^(2t)).`,
          answer: "200e^(0.05t)",
          explain: md`$A = Pe^{rt}$ with $P = 200$ and $r = 0.05$: $A = 200e^{0.05t}$.`,
        },
        {
          kind: "check",
          prompt: md`Simplify $e^{2x} \cdot e^{3x}$.`,
          answer: "e^(5x)",
          simplified: true,
          explain: md`$e$ is a number, so the product rule applies: add the exponents to get $e^{5x}$.`,
        },
      ],
      practice: [eAndExponents, compoundInterest, continuousGrowth],
    },
    {
      id: "logarithms-as-inverse-exponents",
      title: "Logarithms as inverse exponents",
      summary: "The logarithm answers the question \"what exponent?\". It is the inverse of an exponential function.",
      blocks: [
        {
          kind: "text",
          body: md`Solve $2^{x} = 8$. Easy: $x = 3$. Now solve $2^{x} = 10$. Since $2^3 = 8$ and $2^4 = 16$, the answer is somewhere between 3 and 4, and no exponent rule will tell you more. We need a name for "the exponent on 2 that gives 10". That name is $\log_2 10$.`,
        },
        {
          kind: "key",
          title: "Logarithm",
          body: md`For a base $b > 0$ with $b \ne 1$, and a number $y > 0$:

$$\log_b y = x \quad\text{means}\quad b^{x} = y.$$

The logarithm **is an exponent**: the power you raise $b$ to in order to get $y$.

- The **common log** has base 10 and is written without a base: $\log 100 = 2$.
- The **natural log** has base $e$: $\ln y$ means $\log_e y$.

Type them as log_2(8), log(100) and ln(5).`,
        },
        {
          kind: "proof",
          title: "An exponential function is one-to-one",
          given: md`A base $b > 1$ and exponents $x < y$`,
          prove: md`$b^{x} < b^{y}$`,
          steps: [
            { statement: md`$y - x > 0$`, reason: md`Subtract $x$ from both sides of $x < y$` },
            { statement: md`$b^{y - x} > 1$`, reason: md`A positive power of a number greater than 1 is greater than 1: multiplying by $b > 1$ only makes things bigger, and if $b^{1/q}$ were at most 1, so would be its $q$th power, $b$` },
            { statement: md`$b^{y} = b^{x} \cdot b^{y - x}$`, reason: "Product rule" },
            { statement: md`$b^{y} > b^{x}$`, reason: md`$b^{x}$ is positive, and multiplying a positive number by something greater than 1 makes it larger` },
          ],
        },
        {
          kind: "why",
          title: "Why the logarithm exists",
          body: md`The proof shows $b^{x}$ is always increasing when $b > 1$. When $0 < b < 1$ the same argument shows it's always decreasing. Either way, two different inputs never share an output, so $b^{x}$ is **one-to-one** and passes the horizontal line test. By Unit 1, it has an inverse function. That inverse is $\log_b$.

The outputs of $b^{x}$ cover every positive number, with no gaps (the graph shows this; a proof needs ideas from calculus), so $\log_b$ accepts every positive input. It can't accept 0 or a negative number: no power of a positive base is 0 or negative, so there's no exponent to report. **The domain of $\log_b$ is the range of $b^{x}$: $(0, \infty)$.**`,
        },
        {
          kind: "key",
          title: "Inverse identities",
          body: md`Because $\log_b$ and $b^{x}$ undo each other:

$$\log_b\left(b^{x}\right) = x \quad\text{for every } x, \qquad b^{\log_b y} = y \quad\text{for every } y > 0.$$

Two special cases come up constantly: $\log_b 1 = 0$, because $b^0 = 1$, and $\log_b b = 1$, because $b^1 = b$.`,
        },
        {
          kind: "example",
          title: "Evaluating logarithms",
          problem: md`Evaluate $\log_2 32$, $\log_3 \frac{1}{9}$, $\log_4 8$ and $\log 0.001$.`,
          steps: [
            { math: md`\log_2 32 = 5`, note: md`$2^5 = 32$.` },
            { math: md`\log_3 \tfrac{1}{9} = -2`, note: md`$\frac19 = \frac{1}{3^2} = 3^{-2}$.` },
            { math: md`\log_4 8 = \tfrac{3}{2}`, note: md`Write both as powers of 2: $4^{x} = 2^{2x}$ and $8 = 2^3$. So $2x = 3$. (Check: $4^{3/2} = (\sqrt4)^3 = 8$.)` },
            { math: md`\log 0.001 = -3`, note: md`$0.001 = 10^{-3}$.` },
          ],
        },
        {
          kind: "plot",
          x: [-4, 9],
          y: [-4, 9],
          curves: [
            { expr: "x", label: "y = x", color: 3, dashed: true },
            { expr: "b^x", label: "y = b^x", color: 1 },
            { expr: "log_b(x)", label: "y = \\log_b x", color: 2 },
          ],
          points: [
            { x: "c", y: "b^c", label: "({c}, {=b^c})", color: 1 },
            { x: "b^c", y: "c", label: "({=b^c}, {c})", color: 2 },
          ],
          params: [
            { name: "b", min: 1.5, max: 4, step: 0.5, value: 2 },
            { name: "c", min: -2, max: 1.5, step: 0.5, value: 1 },
          ],
          caption: md`Slide $c$ to move along $y = b^{x}$. Its partner on $y = \log_b x$ has the coordinates swapped: the mirror image across $y = x$, as for every inverse (Unit 1). Slide $b$ and both curves change together.`,
        },
        {
          kind: "text",
          body: md`Every feature of the log graph is a feature of the exponential graph with $x$ and $y$ swapped:

- $b^{x}$ passes through $(0, 1)$ and $(1, b)$, so $\log_b x$ passes through $(1, 0)$ and $(b, 1)$.
- $b^{x}$ has the horizontal asymptote $y = 0$, so $\log_b x$ has the vertical asymptote $x = 0$.
- $b^{x}$ has domain all reals and range $(0, \infty)$, so $\log_b x$ has domain $(0, \infty)$ and range all reals.
- For $b > 1$ both increase, but the log climbs very slowly: $\log_2 x$ reaches 10 only at $x = 1024$.`,
        },
        {
          kind: "example",
          title: "Solving by switching forms",
          problem: md`Solve $\log_3 x = 4$, then $\ln x = 2$, then $\log_x 49 = 2$.`,
          steps: [
            { math: md`\log_3 x = 4 \iff x = 3^4 = 81`, note: "Exponential form." },
            { math: md`\ln x = 2 \iff x = e^{2}`, note: md`Base $e$. That's the exact answer; it's about 7.389.` },
            { math: md`\log_x 49 = 2 \iff x^{2} = 49 \;\Rightarrow\; x = 7`, note: md`$x = -7$ also squares to 49, but a base must be positive.` },
          ],
        },
        {
          kind: "why",
          title: "Why you can estimate a logarithm",
          body: md`Since $\log_b$ is increasing (for $b > 1$), a bigger input gives a bigger log. So $\log 500$ is between $\log 100 = 2$ and $\log 1000 = 3$. In fact $\log 500 \approx 2.699$.

For a number 1 or more, the whole-number part of its common log is its count of digits before the decimal point, minus 1: 500 has 3 digits, and $\log 500 \approx 2.699$. That is why logarithms measure things that span huge ranges: the decibel and earthquake magnitude scales are both logarithms.`,
        },
        {
          kind: "check",
          prompt: md`Evaluate $\log_2 \frac{1}{8}$.`,
          answer: "-3",
          explain: md`$\frac18 = \frac{1}{2^3} = 2^{-3}$, so the exponent is $-3$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $\log_5 x = 3$.`,
          answer: "125",
          explain: md`Exponential form: $x = 5^3 = 125$.`,
        },
      ],
      practice: [evaluateLog, solveLogEquation, logGraphsAndInverses],
    },
    {
      id: "properties-of-logarithms",
      title: "Properties of logarithms",
      summary: "Each exponent rule becomes a logarithm rule: products to sums, quotients to differences, powers to multiples, plus change of base.",
      blocks: [
        {
          kind: "text",
          body: md`A logarithm is an exponent, so the exponent rules from Algebra 1, Unit 6 should have logarithm versions. They do, and they are why logarithms were invented. In 1614 John Napier published tables of logarithms that let astronomers turn the multiplication of huge numbers into addition, which is much faster by hand.`,
        },
        {
          kind: "key",
          title: "The rules of logarithms",
          body: md`For $b > 0$, $b \ne 1$, and positive numbers $M$ and $N$:

- **Product rule:** $\log_b(MN) = \log_b M + \log_b N$
- **Quotient rule:** $\log_b \frac{M}{N} = \log_b M - \log_b N$
- **Power rule:** $\log_b\left(M^{k}\right) = k\log_b M$, for any number $k$

Each is an exponent rule in disguise: $b^m b^n = b^{m + n}$, $\frac{b^m}{b^n} = b^{m - n}$ and $(b^m)^k = b^{mk}$.`,
        },
        {
          kind: "proof",
          title: "The product rule",
          given: md`$b > 0$, $b \ne 1$, and $M, N > 0$`,
          prove: md`$\log_b(MN) = \log_b M + \log_b N$`,
          steps: [
            { statement: md`Let $m = \log_b M$ and $n = \log_b N$`, reason: "Name the two exponents" },
            { statement: md`$M = b^{m}$ and $N = b^{n}$`, reason: "Definition of a logarithm" },
            { statement: md`$MN = b^{m} b^{n} = b^{m + n}$`, reason: "Multiply, then the product rule for exponents" },
            { statement: md`$\log_b(MN) = m + n$`, reason: md`Definition of a logarithm: $m + n$ is the exponent that turns $b$ into $MN$` },
            { statement: md`$\log_b(MN) = \log_b M + \log_b N$`, reason: "Substitute back for m and n" },
          ],
        },
        {
          kind: "why",
          title: "Why the quotient and power rules hold",
          body: md`Same names: $M = b^{m}$ and $N = b^{n}$.

**Quotient.** $\frac{M}{N} = \frac{b^{m}}{b^{n}} = b^{m - n}$. So the exponent that gives $\frac{M}{N}$ is $m - n$, which is $\log_b M - \log_b N$.

**Power.** $M^{k} = \left(b^{m}\right)^{k} = b^{mk}$. So the exponent that gives $M^{k}$ is $km$, which is $k\log_b M$.

Every logarithm rule is an exponent rule read through the definition.`,
        },
        {
          kind: "why",
          title: "What the rules don't say",
          body: md`There is no rule for the log of a sum. Test it with base 10: $\log(10 + 10) = \log 20 \approx 1.301$, but $\log 10 + \log 10 = 2$. So $\log(M + N) \ne \log M + \log N$.

Similarly, $\frac{\log M}{\log N}$ is not $\log \frac{M}{N}$: $\frac{\log 100}{\log 10} = \frac{2}{1} = 2$, while $\log \frac{100}{10} = 1$. And $(\log M)^2$ is not $2\log M$: $(\log 1000)^2 = 9$, but $2\log 1000 = 6$. (At $M = 100$ they happen to agree, which is why one example can't prove a rule.) Whenever you're unsure, try small powers of 10.`,
        },
        {
          kind: "example",
          title: "Expanding",
          problem: md`Expand $\log_2 \frac{8x^{3}}{y}$, for $x, y > 0$.`,
          steps: [
            { math: md`\log_2 8 + \log_2 x^{3} - \log_2 y`, note: "Top factors add, the bottom subtracts." },
            { math: md`3 + 3\log_2 x - \log_2 y`, note: md`$\log_2 8 = 3$, and the power rule turns $\log_2 x^3$ into $3\log_2 x$.` },
          ],
        },
        {
          kind: "example",
          title: "Condensing",
          problem: md`Write $2\ln x + \ln 3 - \ln y$ as a single logarithm.`,
          steps: [
            { math: md`\ln x^{2} + \ln 3 - \ln y`, note: "Power rule backwards: the coefficient becomes an exponent. Do this first." },
            { math: md`\ln \frac{3x^{2}}{y}`, note: "Sums multiply into the top; the difference divides." },
          ],
        },
        {
          kind: "example",
          title: "Evaluating with the rules",
          problem: md`Evaluate $\log_6 4 + \log_6 9$.`,
          steps: [
            { math: md`\log_6 (4 \cdot 9) = \log_6 36`, note: "Product rule." },
            { math: md`= 2`, note: md`$6^2 = 36$. Neither $\log_6 4$ nor $\log_6 9$ is a nice number, but their sum is.` },
          ],
        },
        {
          kind: "key",
          title: "Change of base",
          body: md`For any bases $a$ and $b$ (positive, not 1) and $x > 0$:

$$\log_b x = \frac{\log_a x}{\log_a b}, \qquad\text{in particular}\qquad \log_b x = \frac{\ln x}{\ln b} = \frac{\log x}{\log b}.$$

Calculators have only $\ln$ and $\log$; this turns every other base into those.`,
        },
        {
          kind: "proof",
          title: "The change-of-base formula",
          given: md`Bases $a, b > 0$, both not 1, and $x > 0$`,
          prove: md`$\log_b x = \frac{\log_a x}{\log_a b}$`,
          steps: [
            { statement: md`Let $y = \log_b x$`, reason: "Name the number we want" },
            { statement: md`$b^{y} = x$`, reason: "Definition of a logarithm" },
            { statement: md`$\log_a\left(b^{y}\right) = \log_a x$`, reason: md`Equal numbers have equal logs: $\log_a$ is a function` },
            { statement: md`$y\log_a b = \log_a x$`, reason: "Power rule" },
            { statement: md`$y = \frac{\log_a x}{\log_a b}$`, reason: md`Divide; $\log_a b \ne 0$ because $b \ne 1$` },
          ],
        },
        {
          kind: "plot",
          x: [-1, 10],
          y: [-4, 4],
          curves: [
            { expr: "ln(x)", label: "y = \\ln x", color: 3, dashed: true },
            { expr: "log_b(x)", label: "y = \\log_b x", color: 1 },
          ],
          points: [
            { x: 1, y: 0, label: "(1, 0)", color: 2 },
            { x: "b", y: 1, label: "({b}, 1)", color: 1 },
          ],
          params: [{ name: "b", min: 1.5, max: 9, step: 0.5, value: 2 }],
          caption: md`Change of base as a picture: $\log_b x = \frac{1}{\ln b} \cdot \ln x$, so every log graph is $y = \ln x$ stretched or squashed vertically. That's why they all pass through $(1, 0)$: any multiple of $\ln 1 = 0$ is 0.`,
        },
        {
          kind: "example",
          title: "Using change of base",
          problem: md`Approximate $\log_3 20$, and find $\log_8 32$ exactly.`,
          steps: [
            { math: md`\log_3 20 = \frac{\ln 20}{\ln 3} \approx \frac{2.99573}{1.09861} \approx 2.727`, note: md`Sense check: $3^2 = 9$ and $3^3 = 27$, so the answer is between 2 and 3.` },
            { math: md`\log_8 32 = \frac{\ln 32}{\ln 8} = \frac{5\ln 2}{3\ln 2} = \frac{5}{3}`, note: md`$32 = 2^5$ and $8 = 2^3$, then the power rule. $\ln 2$ cancels.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Evaluate $\log_2 40 - \log_2 5$.`,
          answer: "3",
          explain: md`Quotient rule: $\log_2 \frac{40}{5} = \log_2 8 = 3$.`,
        },
        {
          kind: "check",
          prompt: md`Write $\log_2(8x^{5})$ in the form $p + q\log_2 x$. Give $(p, q)$.`,
          answer: "(3, 5)",
          form: "tuple",
          explain: md`Product rule: $\log_2 8 + \log_2 x^5 = 3 + 5\log_2 x$.`,
        },
      ],
      practice: [evaluateWithRules, expandLog, condenseAndChange],
    },
    {
      id: "solving-exponential-equations",
      title: "Solving exponential equations",
      summary: "Solve equations with the variable in an exponent, by matching bases or taking logarithms, and solve log equations while watching for extraneous solutions.",
      blocks: [
        {
          kind: "text",
          body: md`An exponential equation has the unknown in an exponent, like $3^{x} = 7$ or $1000e^{0.05t} = 3000$. You have two tools, and both come from the last two lessons. If both sides are powers of the same base, match the exponents. If not, take a logarithm of both sides and let the power rule bring the exponent down where you can reach it.`,
        },
        {
          kind: "key",
          title: "One-to-one properties",
          body: md`For $b > 0$, $b \ne 1$:

- $b^{x} = b^{y}$ exactly when $x = y$.
- $\log_b x = \log_b y$ exactly when $x = y$ (for $x, y > 0$).`,
        },
        {
          kind: "why",
          title: "Why matching exponents is allowed",
          body: md`In Lesson 3 we proved $b^{x}$ is one-to-one: different exponents always give different powers. So if two powers of the same base are equal, their exponents must be equal. The same goes for $\log_b$, which is one-to-one because it's an inverse.

This only works with the **same** base. $2^{x} = 3^{y}$ doesn't mean $x = y$.`,
        },
        {
          kind: "example",
          title: "Matching bases",
          problem: md`Solve $9^{x + 1} = 27^{x}$.`,
          steps: [
            { math: md`(3^{2})^{x + 1} = (3^{3})^{x}`, note: "9 and 27 are both powers of 3." },
            { math: md`3^{2x + 2} = 3^{3x}`, note: "Power rule." },
            { math: md`2x + 2 = 3x \;\Rightarrow\; x = 2`, note: md`One-to-one. Check: $9^3 = 729 = 27^2$.` },
          ],
        },
        {
          kind: "why",
          title: "Why taking a log of both sides works",
          body: md`If two numbers are equal, their logarithms are equal, because a logarithm is a function: one input, one output. So from $3^{x} = 7$ we may write $\ln 3^{x} = \ln 7$. The power rule then turns $\ln 3^{x}$ into $x\ln 3$, and the unknown is out of the exponent.

Any base of logarithm works. $\ln$ and $\log$ are the usual choices because calculators have them.`,
        },
        {
          kind: "proof",
          title: "Solving bˣ = N",
          given: md`$b > 0$, $b \ne 1$, and $N > 0$`,
          prove: md`$b^{x} = N$ has exactly one solution, $x = \frac{\ln N}{\ln b}$`,
          steps: [
            { statement: md`If $b^{x} = N$, then $\ln b^{x} = \ln N$`, reason: md`$\ln$ is a function, and both sides are positive` },
            { statement: md`$x\ln b = \ln N$`, reason: "Power rule" },
            { statement: md`$\ln b \ne 0$`, reason: md`$\ln b = 0$ would mean $b = e^{0} = 1$` },
            { statement: md`$x = \frac{\ln N}{\ln b}$`, reason: md`Divide by $\ln b$. So no other number can be a solution` },
            { statement: md`$x = \frac{\ln N}{\ln b} = \log_b N$ does satisfy $b^{x} = N$`, reason: md`Change of base, then $b^{\log_b N} = N$` },
          ],
        },
        {
          kind: "plot",
          x: [-2, 3],
          y: [-1, 10],
          curves: [
            { expr: "3^x", label: "y = 3^x", color: 1 },
            { expr: "7", label: "y = 7", color: 2, dashed: true },
          ],
          points: [{ x: "ln(7)/ln(3)", y: 7, label: "\\left(\\frac{\\ln 7}{\\ln 3}, 7\\right)", color: 4 }],
          caption: md`$3^{x} = 7$ asks where the rising curve reaches height 7. Since $3^{x}$ is increasing, there's exactly one such place, at $x = \frac{\ln 7}{\ln 3} \approx 1.771$, between 1 and 2 as you'd expect from $3^1 = 3$ and $3^2 = 9$.`,
        },
        {
          kind: "example",
          title: "How long to triple?",
          problem: md`1000 dollars earns 5% a year, compounded continuously. When will it reach 3000 dollars?`,
          steps: [
            { math: md`1000e^{0.05t} = 3000`, note: md`$A = Pe^{rt}$.` },
            { math: md`e^{0.05t} = 3`, note: "Isolate the power first. Then one ln finishes the job. If a number were added to the power, you'd have to move it before taking logs: there is no rule for the log of a sum." },
            { math: md`0.05t = \ln 3`, note: md`Take $\ln$: $\ln e^{u} = u$.` },
            { math: md`t = \frac{\ln 3}{0.05} = 20\ln 3 \approx 21.97 \text{ years}`, note: "The 1000 didn't matter. Any amount triples in the same time." },
          ],
        },
        {
          kind: "key",
          title: "Solving logarithmic equations",
          body: md`1. Use the rules to get a single logarithm on each side, or one logarithm equal to a number.

2. Rewrite: $\log_b(\ldots) = k$ becomes $(\ldots) = b^{k}$, and $\log_b A = \log_b B$ becomes $A = B$.

3. Solve, then **check every candidate in the original equation**. Throw out any that make the inside of an original logarithm zero or negative.`,
        },
        {
          kind: "why",
          title: "Why extraneous solutions appear",
          body: md`The equation $\log_2 x + \log_2(x - 2) = 3$ only makes sense when $x > 0$ **and** $x - 2 > 0$, that is, for $x > 2$. After the product rule it becomes $\log_2[x(x - 2)] = 3$, which makes sense whenever $x(x - 2) > 0$. That also includes $x < 0$, where both factors are negative and their product is positive.

The combined equation has a bigger domain than the original, so it can have extra solutions. They aren't arithmetic mistakes; they're answers to a slightly different question. Checking in the original catches them, just as with squaring both sides of a radical equation (Algebra 1, Unit 9).`,
        },
        {
          kind: "plot",
          x: [-4, 6],
          y: [-4, 5],
          curves: [
            { expr: "log_2(x(x - 2))", label: "y = \\log_2[x(x - 2)]", color: 2, dashed: true },
            { expr: "log_2(x) + log_2(x - 2)", label: "y = \\log_2 x + \\log_2(x - 2)", color: 1 },
            { expr: "3", label: "y = 3", color: 3 },
          ],
          points: [
            { x: 4, y: 3, label: "(4, 3)", color: 1 },
            { x: -2, y: 3, label: "(-2, 3)", color: 4 },
          ],
          caption: md`The solid curve is the original left side; it lives only on $x > 2$. The dashed combined version agrees with it there but also has a branch on $x < 0$, which meets $y = 3$ at $x = -2$. That crossing is the extraneous solution.`,
        },
        {
          kind: "example",
          title: "A log equation with an extraneous root",
          problem: md`Solve $\log_2 x + \log_2(x - 2) = 3$.`,
          steps: [
            { math: md`\log_2[x(x - 2)] = 3`, note: "Product rule." },
            { math: md`x(x - 2) = 2^{3} = 8`, note: "Exponential form." },
            { math: md`x^{2} - 2x - 8 = 0 \;\Rightarrow\; (x - 4)(x + 2) = 0`, note: "Factor." },
            { math: md`x = 4 \text{ or } x = -2`, note: "Two candidates." },
            { math: md`x = 4`, note: md`$x = -2$ would need $\log_2(-2)$, which doesn't exist. Check 4: $\log_2 4 + \log_2 2 = 2 + 1 = 3$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Solve $2^{x - 1} = 32$.`,
          answer: "6",
          explain: md`$32 = 2^5$, so $x - 1 = 5$ and $x = 6$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $\log_3(x + 2) + \log_3(x - 4) = 3$. List every solution, separated by commas, leaving out extraneous ones.`,
          answer: "7",
          form: "set",
          explain: md`$(x + 2)(x - 4) = 27$ gives $x^2 - 2x - 35 = 0$, so $(x - 7)(x + 5) = 0$. At $x = -5$ the logs don't exist, so only $x = 7$ works.`,
        },
      ],
      practice: [sameBase, takeLogs, logEquations],
    },
  ],
};
